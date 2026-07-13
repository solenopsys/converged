add_library(clipper STATIC "${CMAKE_CURRENT_LIST_DIR}/../vendor/clipper/cpp/clipper.cpp")
target_include_directories(clipper PUBLIC
    "${CMAKE_CURRENT_LIST_DIR}/../vendor/clipper/cpp"
    "${CMAKE_BINARY_DIR}/generated")
add_library(clipper::clipper ALIAS clipper)
set(clipper_FOUND TRUE)
set(clipper_VERSION 6.4.2)
