cmake_minimum_required(VERSION 3.28)
project(onnxruntime_wrapper LANGUAGES C CXX)

set(onnxruntime_BUILD_SHARED_LIB OFF CACHE BOOL "" FORCE)
set(onnxruntime_BUILD_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(onnxruntime_RUN_ONNX_TESTS OFF CACHE BOOL "" FORCE)
set(onnxruntime_ENABLE_PYTHON OFF CACHE BOOL "" FORCE)
set(onnxruntime_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
set(onnxruntime_USE_FULL_PROTOBUF OFF CACHE BOOL "" FORCE)
set(CMAKE_INCLUDE_DIRECTORIES_BEFORE ON)
if(DEFINED ENV{ORT_ZIG_TARGET})
  string(REGEX MATCH "^[^-]+" ORT_ZIG_ARCH "$ENV{ORT_ZIG_TARGET}")
  set(CMAKE_SYSTEM_PROCESSOR "${ORT_ZIG_ARCH}")
endif()
add_subdirectory(vendor/onnxruntime/cmake EXCLUDE_FROM_ALL)

function(disable_ort_werror directory)
  get_property(directory_targets DIRECTORY "${directory}" PROPERTY BUILDSYSTEM_TARGETS)
  foreach(target IN LISTS directory_targets)
    get_target_property(is_imported "${target}" IMPORTED)
    if(NOT is_imported)
      set_target_properties("${target}" PROPERTIES COMPILE_WARNING_AS_ERROR OFF)
    endif()
  endforeach()
  get_property(child_directories DIRECTORY "${directory}" PROPERTY SUBDIRECTORIES)
  foreach(child IN LISTS child_directories)
    disable_ort_werror("${child}")
  endforeach()
endfunction()
disable_ort_werror("${CMAKE_CURRENT_SOURCE_DIR}/vendor/onnxruntime/cmake")

# ORT's fetched headers must precede host Zlib's /usr/include when compiling
# through Zig, otherwise libc++ can mix incompatible host C headers.
if(TARGET ZLIB::ZLIB)
  get_target_property(ZLIB_INCLUDE_DIRS ZLIB::ZLIB INTERFACE_INCLUDE_DIRECTORIES)
  set_property(TARGET ZLIB::ZLIB PROPERTY INTERFACE_INCLUDE_DIRECTORIES "")
  set_property(TARGET ZLIB::ZLIB PROPERTY INTERFACE_SYSTEM_INCLUDE_DIRECTORIES "${ZLIB_INCLUDE_DIRS}")
endif()
if(TARGET libprotobuf-lite)
  target_include_directories(libprotobuf-lite BEFORE PRIVATE "${CMAKE_BINARY_DIR}/_deps/abseil_cpp-src")
endif()

add_library(onnxruntime_wrapper SHARED src/onnxruntime_wrapper.c)
target_compile_definitions(onnxruntime_wrapper PRIVATE ONNXRUNTIME_WRAPPER_BUILD)
target_compile_features(onnxruntime_wrapper PRIVATE c_std_11)
target_include_directories(onnxruntime_wrapper PUBLIC include PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/vendor/onnxruntime/include/onnxruntime/core/session")
target_link_libraries(onnxruntime_wrapper PRIVATE onnxruntime)
set_target_properties(onnxruntime_wrapper PROPERTIES
  OUTPUT_NAME onnxruntime
  LINKER_LANGUAGE CXX
  C_VISIBILITY_PRESET hidden
  VISIBILITY_INLINES_HIDDEN YES)
install(TARGETS onnxruntime_wrapper LIBRARY DESTINATION lib ARCHIVE DESTINATION lib)
install(FILES include/onnxruntime_wrapper.h DESTINATION include)
