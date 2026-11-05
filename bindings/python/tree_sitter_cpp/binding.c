#define PY_SSIZE_T_CLEAN
#include <Python.h>

#ifndef Py_LIMITED_API
#define Py_LIMITED_API 0x03070000
#endif

#include <tree_sitter/parser.h>

extern TSLanguage *tree_sitter_cpp(void);

static PyObject* _binding_language(PyObject *self, PyObject *args) {
    return PyCapsule_New(tree_sitter_cpp(), "tree_sitter.Language", NULL);
}

static PyMethodDef _binding_methods[] = {
    {"language", _binding_language, METH_NOARGS, "Get the tree-sitter language object for C++"},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef _binding_module = {
    PyModuleDef_HEAD_INIT,
    "_binding",
    NULL,
    -1,
    _binding_methods
};

PyMODINIT_FUNC PyInit__binding(void) {
    return PyModule_Create(&_binding_module);
}
