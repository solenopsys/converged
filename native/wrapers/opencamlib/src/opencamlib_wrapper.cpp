#include "opencamlib_wrapper.h"

#include "adaptivepathdropcutter.hpp"
#include "cylcutter.hpp"
#include "line.hpp"
#include "path.hpp"
#include "point.hpp"
#include "stlreader.hpp"
#include "stlsurf.hpp"

#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unistd.h>
#include <vector>

namespace {

thread_local std::string last_error;

void fail(const std::string& message) {
    last_error = message;
}

bool positive(double value) {
    return std::isfinite(value) && value > 0.0;
}

void write_all(int fd, const uint8_t* data, size_t length) {
    size_t offset = 0;
    while (offset < length) {
        const ssize_t written = write(fd, data + offset, length - offset);
        if (written < 0) {
            if (errno == EINTR) continue;
            throw std::runtime_error("failed to write STL bytes");
        }
        offset += static_cast<size_t>(written);
    }
}

class StlFile {
public:
    StlFile(const uint8_t* data, size_t length) {
        char name[] = "/tmp/opencamlib-stl-XXXXXX";
        fd_ = mkstemp(name);
        if (fd_ < 0) throw std::runtime_error("failed to create STL input file");
        path_ = name;
        write_all(fd_, data, length);
        if (lseek(fd_, 0, SEEK_SET) < 0) throw std::runtime_error("failed to rewind STL input");
    }

    ~StlFile() {
        if (fd_ >= 0) close(fd_);
        if (!path_.empty()) unlink(path_.c_str());
    }

    std::wstring path() const {
        std::wstring result;
        result.reserve(path_.size());
        for (const char ch : path_) result.push_back(static_cast<wchar_t>(ch));
        return result;
    }

private:
    int fd_ = -1;
    std::string path_;
};

struct Point3 {
    double x;
    double y;
    double z;
};

double distance(const Point3& a, const Point3& b) {
    return std::hypot(std::hypot(a.x - b.x, a.y - b.y), a.z - b.z);
}

std::vector<double> y_levels(double min_y, double max_y, double stepover) {
    std::vector<double> levels;
    const double span = max_y - min_y;
    const size_t steps = static_cast<size_t>(std::ceil(span / stepover));
    levels.reserve(steps + 1);
    for (size_t index = 0; index <= steps; ++index) {
        const double y = std::min(max_y, min_y + static_cast<double>(index) * stepover);
        if (levels.empty() || std::abs(y - levels.back()) > 1e-9) levels.push_back(y);
    }
    if (levels.empty() || std::abs(levels.back() - max_y) > 1e-9) levels.push_back(max_y);
    return levels;
}

std::string gcode_for(const std::vector<std::vector<Point3>>& passes, double safe_z, double feed) {
    std::ostringstream output;
    output << std::fixed << std::setprecision(4);
    output << "(opencamlib-wrapper)\nG21\nG90\nG0 Z" << safe_z << "\nF" << std::setprecision(2) << feed << "\n";
    output << std::setprecision(4);
    for (const auto& pass : passes) {
        if (pass.empty()) continue;
        output << "G0 X" << pass.front().x << " Y" << pass.front().y << "\n";
        output << "G1 Z" << pass.front().z << "\n";
        for (const Point3& point : pass) {
            output << "G1 X" << point.x << " Y" << point.y << " Z" << point.z << "\n";
        }
        output << "G0 Z" << safe_z << "\n";
    }
    output << "M30\n";
    return output.str();
}

}  // namespace

extern "C" int opencamlib_milling_extract(
    const opencamlib_milling_input* input,
    opencamlib_milling_result* result
) {
    if (!input || !result || !input->stl_data || input->stl_len == 0) {
        fail("stl_data is required");
        return -1;
    }
    std::memset(result, 0, sizeof(*result));
    if (!positive(input->tool_diameter) || !positive(input->tool_length) ||
        !positive(input->stepover) || !positive(input->sampling) ||
        !positive(input->min_sampling) || !positive(input->feed) || !positive(input->rapid) ||
        input->min_sampling > input->sampling) {
        fail("invalid milling parameters");
        return -1;
    }

    try {
        StlFile file(input->stl_data, input->stl_len);
        ocl::STLSurf surface;
        ocl::STLReader reader(file.path(), surface);
        if (surface.size() == 0) throw std::runtime_error("no triangles parsed from STL model");

        const auto& bbox = surface.bb;
        const double safe_z = input->safe_z > 0.0 ? input->safe_z : bbox.maxpt.z + 5.0;
        if (!std::isfinite(safe_z) || safe_z <= bbox.maxpt.z) {
            throw std::runtime_error("safe_z must be above model max Z");
        }

        ocl::CylCutter cutter(input->tool_diameter, input->tool_length);
        ocl::AdaptivePathDropCutter drop_cutter;
        drop_cutter.setSTL(surface);
        drop_cutter.setCutter(&cutter);
        drop_cutter.setSampling(input->sampling);
        drop_cutter.setMinSampling(input->min_sampling);

        std::vector<std::vector<Point3>> passes;
        const std::vector<double> levels = y_levels(bbox.minpt.y, bbox.maxpt.y, input->stepover);
        for (size_t index = 0; index < levels.size(); ++index) {
            const bool reverse = index % 2 != 0;
            const double start_x = reverse ? bbox.maxpt.x : bbox.minpt.x;
            const double end_x = reverse ? bbox.minpt.x : bbox.maxpt.x;
            ocl::Path path;
            path.append(ocl::Line(ocl::Point(start_x, levels[index], 0.0), ocl::Point(end_x, levels[index], 0.0)));
            drop_cutter.setPath(&path);
            drop_cutter.run();
            const std::vector<ocl::CLPoint> points = drop_cutter.getPoints();
            if (points.empty()) continue;
            std::vector<Point3> pass;
            pass.reserve(points.size());
            for (const ocl::CLPoint& point : points) pass.push_back({point.x, point.y, point.z});
            passes.push_back(std::move(pass));
        }
        if (passes.empty()) throw std::runtime_error("failed to generate cutter-location points");

        double cut_length = 0.0;
        double rapid_length = 0.0;
        uint64_t point_count = 0;
        Point3 previous_end{};
        bool has_previous = false;
        for (const auto& pass : passes) {
            point_count += pass.size();
            const Point3& start = pass.front();
            const Point3& end = pass.back();
            if (has_previous) {
                rapid_length += std::abs(safe_z - previous_end.z);
                rapid_length += std::hypot(start.x - previous_end.x, start.y - previous_end.y);
            }
            cut_length += std::abs(safe_z - start.z);
            for (size_t index = 1; index < pass.size(); ++index) cut_length += distance(pass[index - 1], pass[index]);
            previous_end = end;
            has_previous = true;
        }
        rapid_length += std::abs(safe_z - previous_end.z);

        result->triangles = surface.size();
        result->min_x = bbox.minpt.x;
        result->min_y = bbox.minpt.y;
        result->min_z = bbox.minpt.z;
        result->max_x = bbox.maxpt.x;
        result->max_y = bbox.maxpt.y;
        result->max_z = bbox.maxpt.z;
        result->safe_z = safe_z;
        result->passes = static_cast<uint32_t>(passes.size());
        result->points = point_count;
        result->cut_length_mm = cut_length;
        result->rapid_length_mm = rapid_length;
        result->cut_time_sec = cut_length / input->feed * 60.0;
        result->rapid_time_sec = rapid_length / input->rapid * 60.0;
        result->total_time_sec = result->cut_time_sec + result->rapid_time_sec;

        if (input->include_gcode) {
            const std::string gcode = gcode_for(passes, safe_z, input->feed);
            result->gcode = static_cast<uint8_t*>(std::malloc(gcode.size()));
            if (!result->gcode) throw std::bad_alloc();
            std::memcpy(result->gcode, gcode.data(), gcode.size());
            result->gcode_len = gcode.size();
        }
        last_error.clear();
        return 0;
    } catch (const std::exception& error) {
        opencamlib_milling_result_free(result);
        fail(error.what());
        return -1;
    }
}

extern "C" void opencamlib_milling_result_free(opencamlib_milling_result* result) {
    if (!result) return;
    std::free(result->gcode);
    result->gcode = nullptr;
    result->gcode_len = 0;
}

extern "C" const char* opencamlib_wrapper_last_error(void) {
    return last_error.c_str();
}
