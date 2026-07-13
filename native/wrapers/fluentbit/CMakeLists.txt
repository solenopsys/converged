cmake_minimum_required(VERSION 3.20)
project(fluentbit_wrapper LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_POLICY_VERSION_MINIMUM 3.5 CACHE STRING "" FORCE)
add_compile_options(-fvisibility=hidden)

function(flb_option name value)
    set(${name} ${value} CACHE BOOL "" FORCE)
endfunction()

flb_option(FLB_BINARY OFF)
flb_option(FLB_EXAMPLES OFF)
flb_option(FLB_SHARED_LIB OFF)
flb_option(FLB_PROXY_GO OFF)
flb_option(FLB_JEMALLOC OFF)
flb_option(FLB_BACKTRACE OFF)
flb_option(FLB_LUAJIT OFF)
flb_option(FLB_SIGNV4 OFF)
flb_option(FLB_STREAM_PROCESSOR OFF)
flb_option(FLB_HTTP_SERVER OFF)
flb_option(FLB_METRICS OFF)
flb_option(FLB_RECORD_ACCESSOR ON)
flb_option(FLB_PARSER ON)
flb_option(FLB_REGEX ON)
flb_option(FLB_UTF8_ENCODER ON)
flb_option(FLB_SQLDB ON)
flb_option(FLB_INOTIFY ON)
flb_option(FLB_TLS ON)

foreach(plugin
    FLB_IN_CPU FLB_IN_THERMAL FLB_IN_DISK FLB_IN_DOCKER FLB_IN_EXEC
    FLB_IN_FORWARD FLB_IN_HEALTH FLB_IN_HTTP FLB_IN_MEM FLB_IN_KMSG
    FLB_IN_LIB FLB_IN_RANDOM FLB_IN_SERIAL FLB_IN_STDIN FLB_IN_SYSLOG
    FLB_IN_TCP FLB_IN_MQTT FLB_IN_HEAD FLB_IN_PROC FLB_IN_SYSTEMD
    FLB_IN_DUMMY FLB_IN_NETIF FLB_IN_WINLOG FLB_IN_COLLECTD FLB_IN_STATSD
    FLB_IN_STORAGE_BACKLOG FLB_IN_EMITTER
    FLB_OUT_AZURE FLB_OUT_BIGQUERY FLB_OUT_COUNTER FLB_OUT_DATADOG
    FLB_OUT_EXIT FLB_OUT_FORWARD FLB_OUT_GELF FLB_OUT_HTTP FLB_OUT_INFLUXDB
    FLB_OUT_NATS FLB_OUT_TCP FLB_OUT_PLOT FLB_OUT_FILE FLB_OUT_TD
    FLB_OUT_RETRY FLB_OUT_PGSQL FLB_OUT_SLACK FLB_OUT_SPLUNK
    FLB_OUT_STACKDRIVER FLB_OUT_STDOUT FLB_OUT_LIB FLB_OUT_NULL
    FLB_OUT_FLOWCOUNTER FLB_OUT_KAFKA FLB_OUT_KAFKA_REST
    FLB_FILTER_AWS FLB_FILTER_EXPECT FLB_FILTER_GREP FLB_FILTER_MODIFY
    FLB_FILTER_STDOUT FLB_FILTER_PARSER FLB_FILTER_REWRITE_TAG
    FLB_FILTER_THROTTLE FLB_FILTER_NEST FLB_FILTER_LUA
    FLB_FILTER_RECORD_MODIFIER)
    flb_option(${plugin} OFF)
endforeach()
flb_option(FLB_IN_TAIL ON)
flb_option(FLB_OUT_ES ON)
flb_option(FLB_FILTER_KUBERNETES ON)

add_subdirectory(vendor/fluent-bit)
target_compile_options(fluent-bit-static PRIVATE -O3 -ffunction-sections -fdata-sections)

add_library(fluentbit_wrapper SHARED src/fluentbit_wrapper.c)
target_compile_definitions(fluentbit_wrapper PRIVATE FLUENTBIT_WRAPPER_BUILD)
target_include_directories(fluentbit_wrapper
    PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
    PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/vendor/fluent-bit/include")
target_compile_options(fluentbit_wrapper PRIVATE -O3 -fvisibility=hidden -ffunction-sections -fdata-sections)
target_link_options(fluentbit_wrapper PRIVATE
    -Wl,--gc-sections
    -Wl,--strip-all
    "-Wl,--version-script=${CMAKE_CURRENT_SOURCE_DIR}/exports.map")
target_link_libraries(fluentbit_wrapper PRIVATE fluent-bit-static pthread)
set_target_properties(fluentbit_wrapper PROPERTIES OUTPUT_NAME fluentbit)
