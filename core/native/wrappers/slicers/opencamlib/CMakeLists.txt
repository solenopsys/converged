cmake_minimum_required(VERSION 3.20)
project(opencamlib_wrapper LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(OCL_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/vendor/opencamlib/src")
file(GLOB OCL_ROOT_SOURCES "${OCL_ROOT}/*.cpp")
file(GLOB OCL_GEO_SOURCES "${OCL_ROOT}/geo/*.cpp")
file(GLOB OCL_CUTTER_SOURCES "${OCL_ROOT}/cutters/*.cpp")
file(GLOB OCL_ALGO_SOURCES "${OCL_ROOT}/algo/*.cpp")
file(GLOB OCL_DROPCUTTER_SOURCES "${OCL_ROOT}/dropcutter/*.cpp")
file(GLOB OCL_COMMON_SOURCES "${OCL_ROOT}/common/*.cpp")

find_package(Boost REQUIRED)

add_library(opencamlib_wrapper SHARED
    src/opencamlib_wrapper.cpp
    ${OCL_ROOT_SOURCES}
    ${OCL_GEO_SOURCES}
    ${OCL_CUTTER_SOURCES}
    ${OCL_ALGO_SOURCES}
    ${OCL_DROPCUTTER_SOURCES}
    ${OCL_COMMON_SOURCES}
)
target_include_directories(opencamlib_wrapper PRIVATE
    include
    ${OCL_ROOT}
    ${OCL_ROOT}/geo
    ${OCL_ROOT}/cutters
    ${OCL_ROOT}/algo
    ${OCL_ROOT}/dropcutter
    ${OCL_ROOT}/common
)
target_link_libraries(opencamlib_wrapper PRIVATE Boost::boost)
target_compile_options(opencamlib_wrapper PRIVATE -O3 -ffunction-sections -fdata-sections -fvisibility=hidden)
target_link_options(opencamlib_wrapper PRIVATE -Wl,--gc-sections -Wl,-s)
set_target_properties(opencamlib_wrapper PROPERTIES OUTPUT_NAME opencamlib)

install(TARGETS opencamlib_wrapper LIBRARY DESTINATION lib)
install(FILES include/opencamlib_wrapper.h DESTINATION include)
