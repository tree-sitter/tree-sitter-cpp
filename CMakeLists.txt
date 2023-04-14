cmake_minimum_required(VERSION 3.18)
project(tree-sitter-cpp LANGUAGES C CXX)

set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 20)
set(SONAME_MAJOR 0)
set(SONAME_MINOR 0)

include_directories(src)

add_library(tree-sitter-cpp SHARED
        src/parser.c
        src/scanner.cc
        )

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra")
# We don't add `-std=gnu99` here as CMake sets this automatically for GNU-compatible compilers.
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")

# Strip the binary
set_target_properties(tree-sitter-cpp PROPERTIES LINK_FLAGS_RELEASE "-s")

if(WIN32)
    # Don't add the `lib` prefix on Windows.
    set_target_properties(tree-sitter-cpp PROPERTIES PREFIX "")

    # Link statically against `libstdc++.dll` and `libgcc_s.dll` on Windows.
    # We add `-static` here so that `libwinpthread-1.dll` is not linked, either.
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions -static -static-libstdc++ -static-libgcc")
endif()

if(APPLE)
    set_target_properties(tree-sitter-cpp PROPERTIES SUFFIX ".${SONAME_MAJOR}.${SONAME_MINOR}.dylib")
elseif(UNIX)
    set_target_properties(tree-sitter-cpp PROPERTIES SUFFIX ".so.${SONAME_MAJOR}.${SONAME_MINOR}")
endif()
