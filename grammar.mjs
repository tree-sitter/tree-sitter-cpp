/**
 * @file C++ grammar for tree-sitter
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @author John Drouhard <john@drouhard.dev>
 * @author Pablo Hugen <pabloashugen@protonmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl.d.ts" />
// @ts-check

import * as C from 'tree-sitter-c/grammar.mjs';
import {PREC as C_PREC, commaSep, commaSep1, preprocIf} from 'tree-sitter-c/grammar-helpers.mjs';

const PREC = {
  ...C_PREC,
  LAMBDA: 18,
  NEW: C_PREC.CALL + 1,
  STRUCTURED_BINDING: -1,
  THREE_WAY: C_PREC.RELATIONAL + 1,
};

const FOLD_OPERATORS = [
  '+', '-', '*', '/', '%',
  '^', '&', '|',
  '=', '<', '>',
  '<<', '>>',
  '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=',
  '>>=', '<<=',
  '==', '!=', '<=', '>=',
  '&&', '||',
  ',',
  '.*', '->*',
  'or', 'and', 'bitor', 'xor', 'bitand', 'not_eq',
];

const ASSIGNMENT_OPERATORS = [
  '=',
  '*=',
  '/=',
  '%=',
  '+=',
  '-=',
  '<<=',
  '>>=',
  '&=',
  '^=',
  '|=',
  'and_eq',
  'or_eq',
  'xor_eq',
];

export const
  raw_string_delimiter = external(),

  raw_string_content = external(),

  dependent_name = rule(),

  simple_requirement = rule(),

  namespace_identifier = rule(),

  _top_level_item = rule(original => choice(
    ...membersOf(original()).filter(member => !isOldStyleFunction(member)),
    namespace_definition,
    concept_definition,
    namespace_alias_definition,
    using_declaration,
    alias_declaration,
    static_assert_declaration,
    consteval_block_declaration,
    template_declaration,
    template_instantiation,
    module_declaration,
    export_declaration,
    import_declaration,
    global_module_fragment_declaration,
    private_module_fragment_declaration,
    alias(constructor_or_destructor_definition, function_definition),
    alias(operator_cast_definition, function_definition),
    alias(operator_cast_declaration, declaration),
  )),

  _block_item = rule(original => choice(
    ...membersOf(original()).filter(member =>
      !isOldStyleFunction(member) &&
      !('name' in member && member.name.startsWith('preproc_if')),
    ),
    namespace_definition,
    concept_definition,
    namespace_alias_definition,
    using_declaration,
    alias_declaration,
    static_assert_declaration,
    consteval_block_declaration,
    template_declaration,
    template_instantiation,
    export_declaration,
    import_declaration,
    alias(preproc_if_in_block, preproc_if),
    alias(preproc_ifdef_in_block, preproc_ifdef),
    alias(constructor_or_destructor_definition, function_definition),
    alias(operator_cast_definition, function_definition),
    alias(operator_cast_declaration, declaration),
  )),

  {
    preproc_if,
    preproc_ifdef,
    preproc_else,
    preproc_elif,
    preproc_elifdef,
  } = preprocIf('', () => _top_level_item, () => C, 0),

  {
    preproc_if_in_block,
    preproc_ifdef_in_block,
    preproc_else_in_block,
    preproc_elif_in_block,
    preproc_elifdef_in_block,
  } = preprocIf('_in_block', () => _block_item, () => C, 0),

  // Types
  placeholder_type_specifier = rule(() => prec(1, seq(
    field('constraint', optional(choice(
      alias(qualified_type_identifier, qualified_identifier),
      template_type,
      C._type_identifier,
    ))),
    choice(auto, alias(decltype_auto, decltype)),
  ))),

  auto = rule(() => 'auto'),

  decltype_auto = rule(() => seq(
    'decltype',
    '(',
    auto,
    ')',
  )),

  decltype = rule(() => seq(
    'decltype',
    '(',
    C.expression,
    ')',
  )),

  type_specifier = rule(() => choice(
    struct_specifier,
    union_specifier,
    enum_specifier,
    class_specifier,
    C.sized_type_specifier,
    C.primitive_type,
    template_type,
    dependent_type,
    splice_type_specifier,
    placeholder_type_specifier,
    decltype,
    prec.right(choice(
      alias(qualified_type_identifier, qualified_identifier),
      C._type_identifier,
    )),
  )),

  type_qualifier = rule(original => choice(
    original(),
    'mutable',
    'constinit',
    'consteval',
  )),

  type_descriptor = rule(original => prec.right(original())),

  attribute = rule(original => seq(
    optional(seq('using', field('namespace', C.identifier), ':')),
    ...membersOf(original()),
  )),

  annotation = rule(() => seq('=', C.expression)),

  attribute_declaration = rule(original => choice(
    original(),
    seq('[[', commaSep1(annotation), ']]'),
  )),

  // When used in a trailing return type, these specifiers can now occur immediately before
  // a compound statement. This introduces a shift/reduce conflict that needs to be resolved
  // with an associativity.
  _class_declaration = rule(() => seq(
    repeat(choice(C.attribute_specifier, C.alignas_qualifier)),
    optional(C.ms_declspec_modifier),
    repeat(attribute_declaration),
    _class_declaration_item,
  )),

  _class_declaration_item = rule(() => prec.right(seq(
    choice(
      field('name', _class_name),
      seq(
        optional(field('name', _class_name)),
        optional(virtual_specifier),
        optional(base_class_clause),
        field('body', C.field_declaration_list),
      ),
    ),
    optional(C.attribute_specifier),
  ))),

  class_specifier = rule(() => seq(
    'class',
    _class_declaration,
  )),

  union_specifier = rule(() => seq(
    'union',
    _class_declaration,
  )),

  struct_specifier = rule(() => seq(
    'struct',
    _class_declaration,
  )),

  _class_name = rule(() => prec.right(choice(
    C._type_identifier,
    template_type,
    splice_type_specifier,
    alias(qualified_type_identifier, qualified_identifier),
  ))),

  function_definition = rule(original => ({
    ...original(),
    members: membersOf(original()).map(
      (e) => e.type !== 'FIELD' || e.name !== 'body' ?
        e :
        field('body', choice(e.content, try_statement))),
  })),

  declaration = rule(() => seq(
    C._declaration_specifiers,
    commaSep1(field('declarator', choice(
      seq(
        // C uses _declaration_declarator here for some nice macro parsing in function declarators,
        // but this causes a world of pain for C++ so we'll just stick to the normal _declarator here.
        optional(C.ms_call_modifier),
        _declarator,
        optional(C.gnu_asm_expression),
      ),
      init_declarator,
    ))),
    ';',
  )),

  virtual_specifier = rule(() => choice(
    'final', // the only legal value here for classes
    'override', // legal for functions in addition to final, plus permutations.
  )),

  _declaration_modifiers = rule(original => choice(
    original(),
    'virtual',
  )),

  explicit_function_specifier = rule(() => choice(
    'explicit',
    prec(PREC.CALL, seq(
      'explicit',
      '(',
      C.expression,
      ')',
    )),
  )),

  base_class_clause = rule(() => seq(
    ':',
    commaSep1(seq(
      repeat(attribute_declaration),
      optional(choice(
        access_specifier,
        seq(access_specifier, optional('virtual')),
        seq('virtual', optional(access_specifier)),
      )),
      _class_name,
      optional('...'),
    )),
  )),

  enum_specifier = rule(() => prec.right(seq(
    'enum',
    optional(choice('class', 'struct')),
    choice(
      seq(
        field('name', _class_name),
        optional(_enum_base_clause),
        optional(field('body', C.enumerator_list)),
      ),
      field('body', C.enumerator_list),
    ),
    optional(C.attribute_specifier),
  ))),

  _enum_base_clause = rule(() => prec.left(seq(
    ':',
    field('base', choice(
      alias(qualified_type_identifier, qualified_identifier),
      C._type_identifier,
      C.primitive_type,
      C.sized_type_specifier,
    )),
  ))),

  // The `auto` storage class is removed in C++0x in order to allow for the `auto` type.
  storage_class_specifier = rule(original => choice(
    ...membersOf(original()).filter(member => !('value' in member && member.value === 'auto')),
    'thread_local',
  )),

  dependent_type = rule(() => prec.dynamic(-1, prec.right(seq(
    'typename',
    type_specifier,
  )))),

  // Declarations
  module_name = rule(() => seq(
    C.identifier,
    repeat(seq('.', C.identifier),
    ),
  )),

  module_partition = rule(() => seq(
    ':',
    module_name,
  )),

  module_declaration = rule(() => seq(
    optional('export'),
    'module',
    field('name', module_name),
    field('partition', optional(module_partition)),
    optional(attribute_declaration),
    ';',
  )),

  export_declaration = rule(() => prec(1, seq(
    'export',
    choice(_block_item, C.declaration_list),
  ))),

  import_declaration = rule(() => seq(
    'import',
    choice(
      field('name', module_name),
      field('partition', module_partition),
      field('header', choice(
        C.string_literal,
        C.system_lib_string,
      )),
    ),
    optional(attribute_declaration),
    ';',
  )),

  global_module_fragment_declaration = rule(() => seq('module', ';')),

  private_module_fragment_declaration = rule(() => seq('module', ':', 'private', ';')),

  template_declaration = rule(() => seq(
    'template',
    field('parameters', template_parameter_list),
    optional(requires_clause),
    choice(
      C._empty_declaration,
      alias_declaration,
      declaration,
      template_declaration,
      function_definition,
      concept_definition,
      friend_declaration,
      alias(constructor_or_destructor_declaration, declaration),
      alias(constructor_or_destructor_definition, function_definition),
      alias(operator_cast_declaration, declaration),
      alias(operator_cast_definition, function_definition),
    ),
  )),

  template_instantiation = rule(() => prec(1, seq(
    optional('extern'),
    'template',
    optional(C._declaration_specifiers),
    field('declarator', _declarator),
    ';',
  ))),

  template_parameter_list = rule(() => seq(
    '<',
    commaSep(choice(
      C.parameter_declaration,
      optional_parameter_declaration,
      type_parameter_declaration,
      variadic_parameter_declaration,
      variadic_type_parameter_declaration,
      optional_type_parameter_declaration,
      template_template_parameter_declaration,
    )),
    alias(token(prec(1, '>')), '>'),
  )),

  type_parameter_declaration = rule(() => prec(1, seq(
    choice('typename', 'class'),
    optional(C._type_identifier),
  ))),

  variadic_type_parameter_declaration = rule(() => prec(1, seq(
    choice('typename', 'class'),
    '...',
    optional(C._type_identifier),
  ))),

  optional_type_parameter_declaration = rule(() => seq(
    choice('typename', 'class'),
    optional(field('name', C._type_identifier)),
    '=',
    field('default_type', type_specifier),
  )),

  template_template_parameter_declaration = rule(() => seq(
    'template',
    field('parameters', template_parameter_list),
    choice(
      type_parameter_declaration,
      variadic_type_parameter_declaration,
      optional_type_parameter_declaration,
    ),
  )),

  parameter_list = rule(() => seq(
    '(',
    commaSep(choice(
      C.parameter_declaration,
      explicit_object_parameter_declaration,
      optional_parameter_declaration,
      variadic_parameter_declaration,
      '...',
    )),
    ')',
  )),

  explicit_object_parameter_declaration = rule(() => seq(
    this_,
    C.parameter_declaration,
  )),

  optional_parameter_declaration = rule(() => seq(
    C._declaration_specifiers,
    field('declarator', optional(choice(_declarator, abstract_reference_declarator))),
    '=',
    field('default_value', C.expression),
  )),

  variadic_parameter_declaration = rule(() => seq(
    C._declaration_specifiers,
    field('declarator', choice(
      variadic_declarator,
      alias(variadic_reference_declarator, reference_declarator),
    )),
  )),

  variadic_declarator = rule(() => seq(
    '...',
    optional(C.identifier),
  )),

  variadic_reference_declarator = rule(() => seq(
    choice('&&', '&'),
    variadic_declarator,
  )),

  init_declarator = rule(original => choice(
    original(),
    seq(
      field('declarator', _declarator),
      field('value', choice(
        argument_list,
        C.initializer_list,
      )),
    ),
  )),

  operator_cast = rule(() => prec.right(1, seq(
    'operator',
    C._declaration_specifiers,
    field('declarator', _abstract_declarator),
  ))),

  // Avoid ambiguity between compound statement and initializer list in a construct like:
  //   A b {};
  compound_statement = rule(original => prec(-1, original())),

  field_initializer_list = rule(() => seq(
    ':',
    commaSep1(field_initializer),
  )),

  field_initializer = rule(() => prec(1, seq(
    choice(
      C._field_identifier,
      template_method,
      alias(qualified_field_identifier, qualified_identifier),
    ),
    choice(C.initializer_list, argument_list),
    optional('...'),
  ))),

  _field_declaration_list_item = rule(original => choice(
    original(),
    template_declaration,
    alias(inline_method_definition, function_definition),
    alias(constructor_or_destructor_definition, function_definition),
    alias(constructor_or_destructor_declaration, declaration),
    alias(operator_cast_definition, function_definition),
    alias(operator_cast_declaration, declaration),
    friend_declaration,
    seq(access_specifier, ':'),
    alias_declaration,
    using_declaration,
    C.type_definition,
    static_assert_declaration,
    consteval_block_declaration,
    ';',
  )),

  field_declaration = rule(() => seq(
    C._declaration_specifiers,
    commaSep(seq(
      field('declarator', _field_declarator),
      optional(choice(
        C.bitfield_clause,
        field('default_value', C.initializer_list),
        seq('=', field('default_value', choice(C.expression, C.initializer_list))),
      )),
    )),
    optional(C.attribute_specifier),
    ';',
  )),

  inline_method_definition = rule(() => seq(
    C._declaration_specifiers,
    field('declarator', _field_declarator),
    choice(
      field('body', choice(compound_statement, try_statement)),
      default_method_clause,
      delete_method_clause,
      pure_virtual_clause,
    ),
  )),

  _constructor_specifiers = rule(() => choice(
    _declaration_modifiers,
    explicit_function_specifier,
  )),

  operator_cast_definition = rule(() => seq(
    repeat(_constructor_specifiers),
    field('declarator', choice(
      operator_cast,
      alias(qualified_operator_cast_identifier, qualified_identifier),
    )),
    field('body', choice(compound_statement, try_statement)),
  )),

  operator_cast_declaration = rule(() => prec(1, seq(
    repeat(_constructor_specifiers),
    field('declarator', choice(
      operator_cast,
      alias(qualified_operator_cast_identifier, qualified_identifier),
    )),
    optional(seq('=', field('default_value', C.expression))),
    ';',
  ))),

  constructor_try_statement = rule(() => seq(
    'try',
    optional(field_initializer_list),
    field('body', compound_statement),
    repeat1(catch_clause),
  )),

  constructor_or_destructor_definition = rule(() => seq(
    repeat(_constructor_specifiers),
    field('declarator', function_declarator),
    choice(
      seq(
        optional(field_initializer_list),
        field('body', compound_statement),
      ),
      alias(constructor_try_statement, try_statement),
      default_method_clause,
      delete_method_clause,
      pure_virtual_clause,
    ),
  )),

  constructor_or_destructor_declaration = rule(() => seq(
    repeat(_constructor_specifiers),
    field('declarator', function_declarator),
    ';',
  )),

  default_method_clause = rule(() => seq('=', 'default', ';')),

  delete_method_clause = rule(() => seq('=', 'delete', ';')),

  pure_virtual_clause = rule(() => seq('=', /0/, ';')),

  friend_declaration = rule(() => seq(
    optional('constexpr'),
    'friend',
    choice(
      declaration,
      function_definition,
      seq(
        optional(choice(
          'class',
          'struct',
          'union',
        )),
        _class_name, ';',
      ),
    ),
  )),

  access_specifier = rule(() => choice(
    'public',
    'private',
    'protected',
  )),

  _declarator = rule(original => choice(
    original(),
    reference_declarator,
    qualified_identifier,
    template_function,
    operator_name,
    destructor_name,
    structured_binding_declarator,
  )),

  _field_declarator = rule(original => choice(
    original(),
    alias(reference_field_declarator, reference_declarator),
    template_method,
    operator_name,
  )),

  _type_declarator = rule(original => choice(
    original(),
    alias(reference_type_declarator, reference_declarator),
  )),

  _abstract_declarator = rule(original => choice(
    original(),
    abstract_reference_declarator,
  )),

  reference_declarator = rule(() => prec.dynamic(1, prec.right(seq(choice('&', '&&'), _declarator)))),

  reference_field_declarator = rule(() => prec.dynamic(1, prec.right(seq(choice('&', '&&'), _field_declarator)))),

  reference_type_declarator = rule(() => prec.dynamic(1, prec.right(seq(choice('&', '&&'), _type_declarator)))),

  abstract_reference_declarator = rule(() => prec.right(seq(choice('&', '&&'), optional(_abstract_declarator)))),

  structured_binding_declarator = rule(() => prec.dynamic(PREC.STRUCTURED_BINDING, seq(
    '[', commaSep1(C.identifier), ']',
  ))),

  ref_qualifier = rule(() => choice('&', '&&')),

  _function_declarator_seq = rule(() => seq(
    field('parameters', parameter_list),
    optional(_function_attributes_start),
    optional(ref_qualifier),
    optional(_function_exception_specification),
    optional(_function_attributes_end),
    optional(trailing_return_type),
    optional(_function_postfix),
  )),

  _function_attributes_start = rule(() => prec(1, choice(
    seq(repeat1(C.attribute_specifier), repeat(type_qualifier)),
    seq(repeat(C.attribute_specifier), repeat1(type_qualifier)),
  ))),

  _function_exception_specification = rule(() => choice(
    noexcept,
    throw_specifier,
  )),

  _function_attributes_end = rule(() => prec.right(seq(
    optional(C.gnu_asm_expression),
    choice(
      seq(repeat1(C.attribute_specifier), repeat(attribute_declaration)),
      seq(repeat(C.attribute_specifier), repeat1(attribute_declaration)),
    ),
  ))),

  _function_postfix = rule(() => prec.right(choice(
    repeat1(virtual_specifier),
    requires_clause,
  ))),

  function_declarator = rule(() => prec.dynamic(1, seq(
    field('declarator', _declarator),
    _function_declarator_seq,
  ))),

  function_field_declarator = rule(() => prec.dynamic(1, seq(
    field('declarator', _field_declarator),
    _function_declarator_seq,
  ))),

  abstract_function_declarator = rule(() => seq(
    field('declarator', optional(_abstract_declarator)),
    _function_declarator_seq,
  )),

  trailing_return_type = rule(() => seq('->', type_descriptor)),

  noexcept = rule(() => prec.right(seq(
    'noexcept',
    optional(
      seq(
        '(',
        optional(C.expression),
        ')',
      ),
    ),
  ))),

  throw_specifier = rule(() => seq(
    'throw',
    seq(
      '(',
      commaSep(type_descriptor),
      ')',
    ),
  )),

  template_type = rule(() => seq(
    field('name', C._type_identifier),
    field('arguments', template_argument_list),
  )),

  template_method = rule(() => seq(
    field('name', choice(C._field_identifier, operator_name)),
    field('arguments', template_argument_list),
  )),

  template_function = rule(() => seq(
    field('name', C.identifier),
    field('arguments', template_argument_list),
  )),

  template_argument_list = rule(() => seq(
    '<',
    commaSep(choice(
      prec.dynamic(3, type_descriptor),
      prec.dynamic(2, alias(type_parameter_pack_expansion, parameter_pack_expansion)),
      prec.dynamic(1, C.expression),
    )),
    alias(token(prec(1, '>')), '>'),
  )),

  namespace_definition = rule(() => seq(
    optional('inline'),
    'namespace',
    optional(attribute_declaration),
    field('name', optional(
      choice(
        _namespace_identifier,
        nested_namespace_specifier,
      ))),
    field('body', C.declaration_list),
  )),

  namespace_alias_definition = rule(() => seq(
    'namespace',
    field('name', _namespace_identifier),
    '=',
    choice(
      _namespace_identifier,
      nested_namespace_specifier,
      splice_specifier,
    ),
    ';',
  )),

  _namespace_specifier = rule(() => seq(
    optional('inline'),
    _namespace_identifier,
  )),

  nested_namespace_specifier = rule(() => prec(1, seq(
    optional(_namespace_specifier),
    '::',
    choice(
      nested_namespace_specifier,
      _namespace_specifier,
    ),
  ))),

  using_declaration = rule(() => seq(
    repeat(attribute_declaration),
    'using',
    optional(choice('namespace', 'enum')),
    choice(
      C.identifier,
      qualified_identifier,
      splice_type_specifier,
    ),
    ';',
  )),

  alias_declaration = rule(() => seq(
    'using',
    field('name', C._type_identifier),
    repeat(attribute_declaration),
    '=',
    field('type', type_descriptor),
    ';',
  )),

  static_assert_declaration = rule(() => seq(
    'static_assert',
    '(',
    field('condition', C.expression),
    optional(seq(
      ',',
      field('message', _string),
    )),
    ')',
    ';',
  )),

  consteval_block_declaration = rule(() => seq(
    'consteval',
    field('body', compound_statement),
  )),

  concept_definition = rule(() => seq(
    'concept',
    field('name', C.identifier),
    '=',
    C.expression,
    ';',
  )),

  // Statements
  _top_level_statement = rule(original => choice(
    original(),
    co_return_statement,
    co_yield_statement,
    for_range_loop,
    expansion_statement,
    try_statement,
    throw_statement,
  )),

  _non_case_statement = rule(original => choice(
    original(),
    co_return_statement,
    co_yield_statement,
    for_range_loop,
    expansion_statement,
    try_statement,
    throw_statement,
  )),

  switch_statement = rule(() => seq(
    'switch',
    field('condition', condition_clause),
    field('body', compound_statement),
  )),

  while_statement = rule(() => seq(
    'while',
    field('condition', condition_clause),
    field('body', C.statement),
  )),

  if_statement = rule(() => prec.right(seq(
    'if',
    optional('constexpr'),
    field('condition', condition_clause),
    field('consequence', C.statement),
    optional(field('alternative', C.else_clause)),
  ))),

  // Using prec(1) instead of prec.dynamic(1) causes issues with the
  // range loop's declaration specifiers if `int` is passed in, it'll
  // always prefer the standard for loop and give us a parse error.
  _for_statement_body = rule(original => prec.dynamic(1, original())),

  for_range_loop = rule(() => seq(
    'for',
    '(',
    _for_range_loop_body,
    ')',
    field('body', C.statement),
  )),

  _for_range_loop_body = rule(() => seq(
    field('initializer', optional(init_statement)),
    C._declaration_specifiers,
    field('declarator', _declarator),
    ':',
    field('right', choice(
      C.expression,
      C.initializer_list,
    )),
  )),

  init_statement = rule(() => choice(
    alias_declaration,
    C.type_definition,
    declaration,
    C.expression_statement,
  )),

  condition_clause = rule(() => seq(
    '(',
    field('initializer', optional(init_statement)),
    field('value', choice(
      C.expression,
      C.comma_expression,
      alias(condition_declaration, declaration),
    )),
    ')',
  )),

  condition_declaration = rule(() => seq(
    C._declaration_specifiers,
    field('declarator', _declarator),
    choice(
      seq(
        '=',
        field('value', C.expression),
      ),
      field('value', C.initializer_list),
    ),
  )),

  return_statement = rule(original => seq(
    choice(
      original(),
      seq('return', C.initializer_list, ';'),
    ),
  )),

  co_return_statement = rule(() => seq(
    'co_return',
    optional(C.expression),
    ';',
  )),

  co_yield_statement = rule(() => seq(
    'co_yield',
    C.expression,
    ';',
  )),

  throw_statement = rule(() => seq(
    'throw',
    optional(C.expression),
    ';',
  )),

  try_statement = rule(() => seq(
    'try',
    field('body', compound_statement),
    repeat1(catch_clause),
  )),

  catch_clause = rule(() => seq(
    'catch',
    field('parameters', parameter_list),
    field('body', compound_statement),
  )),

  // Expressions
  _expression_not_binary = rule(original => choice(
    original(),
    co_await_expression,
    requires_expression,
    requires_clause,
    template_function,
    qualified_identifier,
    new_expression,
    delete_expression,
    lambda_expression,
    parameter_pack_expansion,
    this_,
    user_defined_literal,
    fold_expression,
    reflect_expression,
    splice_expression,
  )),

  _string = rule(() => choice(
    C.string_literal,
    raw_string_literal,
    concatenated_string,
  )),

  raw_string_literal = rule(() => seq(
    choice('R"', 'LR"', 'uR"', 'UR"', 'u8R"'),
    choice(
      seq(
        field('delimiter', raw_string_delimiter),
        '(',
        raw_string_content,
        ')',
        raw_string_delimiter,
      ),
      seq('(', raw_string_content, ')'),
    ),
    '"',
  )),

  subscript_expression = rule(() => prec(PREC.SUBSCRIPT, seq(
    field('argument', C.expression),
    field('indices', subscript_argument_list),
  ))),

  subscript_argument_list = rule(() => seq(
    '[',
    commaSep(choice(C.expression, C.initializer_list)),
    ']',
  )),

  call_expression = rule(original => prec.dynamic(1, choice(original(), seq(
    field('function', choice(C.primitive_type, seq(
      optional('typename'),
      splice_type_specifier,
    ))),
    field('arguments', argument_list),
  )))),

  co_await_expression = rule(() => prec.left(PREC.UNARY, seq(
    field('operator', 'co_await'),
    field('argument', C.expression),
  ))),

  new_expression = rule(() => prec.right(PREC.NEW, seq(
    optional('::'),
    'new',
    field('placement', optional(argument_list)),
    field('type', type_specifier),
    field('declarator', optional(new_declarator)),
    field('arguments', optional(choice(
      argument_list,
      C.initializer_list,
    ))),
  ))),

  new_declarator = rule(() => prec.right(seq(
    '[',
    field('length', C.expression),
    ']',
    optional(new_declarator),
  ))),

  delete_expression = rule(() => seq(
    optional('::'),
    'delete',
    optional(seq('[', ']')),
    C.expression,
  )),

  field_expression = rule(() => seq(
    prec(PREC.FIELD, seq(
      field('argument', C.expression),
      field('operator', choice('.', '.*', '->')),
    )),
    field('field', choice(
      prec.dynamic(1, C._field_identifier),
      alias(qualified_field_identifier, qualified_identifier),
      destructor_name,
      template_method,
      alias(dependent_field_identifier, dependent_name),
      operator_name,
      splice_expression,
    )),
  )),

  type_requirement = rule(() => seq('typename', _class_name)),

  compound_requirement = rule(() => seq(
    '{', C.expression, '}',
    optional('noexcept'),
    optional(trailing_return_type),
    ';',
  )),

  _requirement = rule(() => choice(
    alias(C.expression_statement, simple_requirement),
    type_requirement,
    compound_requirement,
  )),

  requirement_seq = rule(() => seq('{', repeat(_requirement), '}')),

  constraint_conjunction = rule(() => prec.left(PREC.LOGICAL_AND, seq(
    field('left', _requirement_clause_constraint),
    field('operator', choice('&&', 'and')),
    field('right', _requirement_clause_constraint)),
  )),

  constraint_disjunction = rule(() => prec.left(PREC.LOGICAL_OR, seq(
    field('left', _requirement_clause_constraint),
    field('operator', choice('||', 'or')),
    field('right', _requirement_clause_constraint)),
  )),

  _requirement_clause_constraint = rule(() => choice(
    // Primary expressions"
    C.true,
    C.false,
    _class_name,
    fold_expression,
    lambda_expression,
    requires_expression,

    // Parenthesized expressions
    seq('(', C.expression, ')'),

    // conjunction or disjunction of the above
    constraint_conjunction,
    constraint_disjunction,
  )),

  requires_clause = rule(() => seq(
    'requires',
    field('constraint', _requirement_clause_constraint),
  )),

  requires_parameter_list = rule(() => seq(
    '(',
    commaSep(choice(
      C.parameter_declaration,
      optional_parameter_declaration,
      variadic_parameter_declaration,
    )),
    ')',
  )),

  requires_expression = rule(() => seq(
    'requires',
    field('parameters', optional(alias(requires_parameter_list, parameter_list))),
    field('requirements', requirement_seq),
  )),

  lambda_specifier = rule(() => choice(
    'static',
    'constexpr',
    'consteval',
    'mutable',
  )),

  lambda_declarator = rule(() => choice(
    // main declarator form, includes parameter list
    seq(
      repeat(attribute_declaration),
      field('parameters', parameter_list),
      repeat(lambda_specifier),
      optional(_function_exception_specification),
      repeat(attribute_declaration),
      optional(trailing_return_type),
      optional(requires_clause),
    ),

    // forms supporting omitted parameter list
    repeat1(attribute_declaration),
    seq(
      repeat(attribute_declaration),
      trailing_return_type,
    ),
    seq(
      repeat(attribute_declaration),
      _function_exception_specification,
      repeat(attribute_declaration),
      optional(trailing_return_type),
    ),
    seq(
      repeat(attribute_declaration),
      repeat1(lambda_specifier),
      optional(_function_exception_specification),
      repeat(attribute_declaration),
      optional(trailing_return_type),
    ),
  )),

  lambda_expression = rule(() => seq(
    field('captures', lambda_capture_specifier),
    optional(seq(
      field('template_parameters', template_parameter_list),
      optional(field('constraint', requires_clause)),
    )),
    optional(field('declarator', lambda_declarator)),
    field('body', compound_statement),
  )),

  lambda_capture_specifier = rule(() => prec(PREC.LAMBDA, seq(
    '[',
    choice(
      lambda_default_capture,
      commaSep(_lambda_capture),
      seq(
        lambda_default_capture,
        ',', commaSep1(_lambda_capture),
      ),
    ),
    ']',
  ))),

  lambda_default_capture = rule(() => choice('=', '&')),

  _lambda_capture_identifier = rule(() => seq(
    optional('&'),
    choice(
      C.identifier,
      qualified_identifier,
      alias(identifier_parameter_pack_expansion, parameter_pack_expansion),
    ),
  )),

  lambda_capture_initializer = rule(() => seq(
    optional('&'),
    optional('...'),
    field('left', C.identifier),
    '=',
    field('right', C.expression),
  )),

  _lambda_capture = rule(() => choice(
    seq(optional('*'), this_),
    _lambda_capture_identifier,
    lambda_capture_initializer,
  )),

  _fold_operator = rule(() => choice(...FOLD_OPERATORS)),

  _binary_fold_operator = rule(() => choice(...FOLD_OPERATORS.map((operator) => seq(field('operator', operator), '...', operator)))),

  _unary_left_fold = rule(() => seq(
    field('left', '...'),
    field('operator', _fold_operator),
    field('right', C.expression),
  )),

  _unary_right_fold = rule(() => seq(
    field('left', C.expression),
    field('operator', _fold_operator),
    field('right', '...'),
  )),

  _binary_fold = rule(() => seq(
    field('left', C.expression),
    _binary_fold_operator,
    field('right', C.expression),
  )),

  fold_expression = rule(() => seq(
    '(',
    choice(
      _unary_right_fold,
      _unary_left_fold,
      _binary_fold,
    ),
    ')',
  )),

  parameter_pack_expansion = rule(() => prec(-1, seq(
    field('pattern', C.expression),
    '...',
  ))),

  type_parameter_pack_expansion = rule(() => seq(
    field('pattern', type_descriptor),
    '...',
  )),

  identifier_parameter_pack_expansion = rule(() => seq(
    field('pattern', C.identifier),
    '...',
  )),

  sizeof_expression = rule(original => prec.right(PREC.SIZEOF, choice(
    original(),
    seq(
      'sizeof', '...',
      '(',
      field('value', C.identifier),
      ')',
    ),
  ))),

  unary_expression = rule(original => choice(
    original(),
    prec.left(PREC.UNARY, seq(
      field('operator', choice('not', 'compl')),
      field('argument', C.expression),
    )),
  )),

  binary_expression = rule(original => {
    const table = [
      ['<=>', PREC.THREE_WAY],
      ['or', PREC.LOGICAL_OR],
      ['and', PREC.LOGICAL_AND],
      ['bitor', PREC.INCLUSIVE_OR],
      ['xor', PREC.EXCLUSIVE_OR],
      ['bitand', PREC.BITWISE_AND],
      ['not_eq', PREC.EQUAL],
    ];

    return choice(
      original(),
      ...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', C.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', C.expression),
        ));
      }));
  }),

  // The compound_statement is added to parse macros taking statements as arguments, e.g. MYFORLOOP(1, 10, i, { foo(i); bar(i); })
  argument_list = rule(() => seq(
    '(',
    commaSep(choice(C.expression, C.initializer_list, compound_statement)),
    ')',
  )),

  destructor_name = rule(() => prec(1, seq('~', C.identifier))),

  compound_literal_expression = rule(original => choice(
    original(),
    seq(
      field('type', choice(
        _class_name,
        C.primitive_type,
        seq(optional('typename'), splice_type_specifier))),
      field('value', C.initializer_list),
    ),
  )),

  dependent_identifier = rule(() => seq('template', template_function)),

  dependent_field_identifier = rule(() => seq('template', template_method)),

  dependent_type_identifier = rule(() => seq('template', template_type)),

  _scope_resolution = rule(() => prec(1, seq(
    field('scope', optional(choice(
      _namespace_identifier,
      template_type,
      decltype,
      splice_expression,
      splice_type_specifier,
      alias(dependent_type_identifier, dependent_name),
    ))),
    '::',
  ))),

  qualified_field_identifier = rule(() => seq(
    _scope_resolution,
    field('name', choice(
      alias(dependent_field_identifier, dependent_name),
      alias(qualified_field_identifier, qualified_identifier),
      template_method,
      prec.dynamic(2, C._field_identifier),
    )),
  )),

  qualified_identifier = rule(() => seq(
    _scope_resolution,
    field('name', choice(
      alias(dependent_identifier, dependent_name),
      qualified_identifier,
      template_function,
      prec.dynamic(1, seq(optional('template'), C.identifier)),
      operator_name,
      destructor_name,
      C.pointer_type_declarator,
    )),
  )),

  qualified_type_identifier = rule(() => seq(
    _scope_resolution,
    field('name', choice(
      alias(dependent_type_identifier, dependent_name),
      alias(qualified_type_identifier, qualified_identifier),
      template_type,
      prec.dynamic(1, C._type_identifier),
    )),
  )),

  qualified_operator_cast_identifier = rule(() => seq(
    _scope_resolution,
    field('name', choice(
      alias(qualified_operator_cast_identifier, qualified_identifier),
      operator_cast,
    )),
  )),

  _assignment_left_expression = rule(original => choice(
    original(),
    qualified_identifier,
    user_defined_literal,
  )),

  assignment_expression = rule(() => prec.right(PREC.ASSIGNMENT, seq(
    field('left', _assignment_left_expression),
    field('operator', choice(...ASSIGNMENT_OPERATORS)),
    field('right', choice(C.expression, C.initializer_list)),
  ))),

  _assignment_expression_lhs = rule(() => seq(
    field('left', C.expression),
    field('operator', choice(...ASSIGNMENT_OPERATORS)),
    field('right', choice(C.expression, C.initializer_list)),
  )),

  // This prevents an ambiguity between fold expressions
  // and assignment expressions within parentheses.
  parenthesized_expression = rule(original => choice(
    original(),
    seq('(', alias(_assignment_expression_lhs, assignment_expression), ')'),
  )),

  reflect_expression = rule(() => prec.right(seq(
    '^^',
    choice(
      '::',
      C.expression,
      type_descriptor,
    ),
  ))),

  splice_specifier = rule(() => seq( '[:', C.expression, ':]')),

  _splice_specialization_specifier = rule(() => seq(splice_specifier, template_argument_list)),

  splice_type_specifier = rule(() => prec.right(choice(
    splice_specifier,
    _splice_specialization_specifier,
  ))),

  splice_expression = rule(() => prec.right(choice(
    splice_specifier,
    seq('template', _splice_specialization_specifier),
  ))),

  expansion_statement = rule(() => seq(
    'template', 'for',
    '(',
    _for_range_loop_body,
    ')',
    field('body', C.statement),
  )),

  operator_name = rule(() => prec(1, seq(
    'operator',
    choice(
      'co_await',
      '+', '-', '*', '/', '%',
      '^', '&', '|', '~',
      '!', '=', '<', '>',
      '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=',
      '<<', '>>', '>>=', '<<=',
      '==', '!=', '<=', '>=',
      '<=>',
      '&&', '||',
      '++', '--',
      ',',
      '->*',
      '->',
      '()', '[]',
      'xor', 'bitand', 'bitor', 'compl',
      'not', 'xor_eq', 'and_eq', 'or_eq', 'not_eq',
      'and', 'or',
      seq(choice('new', 'delete'), optional('[]')),
      seq('""', C.identifier),
    ),
  ))),

  concatenated_string = rule(() => prec.right(seq(
    choice(C.identifier, C.string_literal, raw_string_literal),
    choice(C.string_literal, raw_string_literal),
    repeat(choice(C.identifier, C.string_literal, raw_string_literal)),
  ))),

  number_literal = rule(() => {
    const sign = /[-\+]/;
    const separator = '\'';
    const binary = /[01]/;
    const binaryDigits = seq(repeat1(binary), repeat(seq(separator, repeat1(binary))));
    const decimal = /[0-9]/;
    const firstDecimal = /[1-9]/;
    const intDecimalDigits = seq(firstDecimal, repeat(decimal), repeat(seq(separator, repeat1(decimal))));
    const floatDecimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
    const hex = /[0-9a-fA-F]/;
    const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
    const octal = /[0-7]/;
    const octalDigits = seq('0', repeat(octal), repeat(seq(separator, repeat1(octal))));
    const hexExponent = seq(/[pP]/, optional(sign), floatDecimalDigits);
    const decimalExponent = seq(/[eE]/, optional(sign), floatDecimalDigits);
    const intSuffix = /(ll|LL)[uU]?|[uU](ll|LL)?|[uU][lL]?|[uU][zZ]?|[lL][uU]?|[zZ][uU]?/;
    const floatSuffix = /([fF](16|32|64|128)?)|[lL]|(bf16|BF16)/;

    return token(seq(
      optional(sign),
      choice(
        seq(
          choice(
            seq(choice('0b', '0B'), binaryDigits),
            intDecimalDigits,
            seq(choice('0x', '0X'), hexDigits),
            octalDigits,
          ),
          optional(intSuffix),
        ),
        seq(
          choice(
            seq(floatDecimalDigits, decimalExponent),
            seq(floatDecimalDigits, '.', optional(floatDecimalDigits), optional(decimalExponent)),
            seq('.', floatDecimalDigits, optional(decimalExponent)),
            seq(
              choice('0x', '0X'),
              choice(
                hexDigits,
                seq(hexDigits, '.', optional(hexDigits)),
                seq('.', hexDigits)),
              hexExponent,
            ),
          ),
          optional(floatSuffix),
        ),
      ),
    ));
  }),

  literal_suffix = rule(() => token.immediate(/[a-zA-Z_]\w*/)),

  user_defined_literal = rule(() => seq(
    choice(
      number_literal,
      C.char_literal,
      _string,
    ),
    literal_suffix,
  )),

  _namespace_identifier = rule(() => alias(C.identifier, namespace_identifier));

// The public name cannot be used as a local binding in an ES module.
const this_ = rule(() => 'this');
export {this_ as this};

/**
 * Inspect a normalized inherited choice or sequence without weakening its type.
 *
 * @param {Rule} expression
 * @returns {Rule[]}
 */
function membersOf(expression) {
  if (expression.type !== 'CHOICE' && expression.type !== 'SEQ') {
    throw new Error(`Expected an inherited choice or sequence, got ${expression.type}`);
  }
  return expression.members;
}

/**
 * @param {Rule} expression
 * @returns {boolean}
 */
function isOldStyleFunction(expression) {
  return 'content' in expression && 'name' in expression.content &&
    expression.content.name === '_old_style_function_definition';
}

/** @satisfies {ModuleGrammar} */
export default {
  name: 'cpp',
  extends: C,

  externals: [
    raw_string_delimiter,
    raw_string_content,
  ],

  conflicts: [
    // C
    [type_specifier, _declarator],
    [type_specifier, C.expression],
    [C.sized_type_specifier],
    [C.attributed_statement],
    [_declaration_modifiers, C.attributed_statement],
    [_declaration_modifiers, using_declaration],
    [_declaration_modifiers, C.attributed_statement, using_declaration],
    [_top_level_item, _top_level_statement],
    [_block_item, C.statement],
    [type_qualifier, C.extension_expression],

    // C++
    [template_function, template_type],
    [template_function, template_type, C.expression],
    [template_function, template_type, qualified_identifier],
    [template_function, template_type, qualified_identifier, qualified_type_identifier],
    [template_type, qualified_type_identifier],
    [qualified_type_identifier, qualified_identifier],
    [C.comma_expression, C.initializer_list],
    [C.expression, _declarator],
    [C.expression, structured_binding_declarator],
    [C.expression, _declarator, type_specifier],
    [C.expression, identifier_parameter_pack_expansion],
    [C.expression, _lambda_capture_identifier],
    [C.expression, _lambda_capture],
    [C.expression, structured_binding_declarator, _lambda_capture_identifier],
    [structured_binding_declarator, _lambda_capture_identifier],
    [parameter_list, argument_list],
    [type_specifier, call_expression],
    [C._declaration_specifiers, _constructor_specifiers],
    [_binary_fold_operator, _fold_operator],
    [_function_declarator_seq],
    [type_specifier, C.sized_type_specifier],
    [C.initializer_pair, C.comma_expression],
    [C.expression_statement, _for_statement_body],
    [init_statement, _for_statement_body],
    [field_expression, template_method, template_type],
    [field_expression, template_method],
    [qualified_field_identifier, template_method, template_type],
    [type_specifier, template_type, template_function, C.expression],
    [splice_type_specifier, splice_expression],
  ],

  inline: [...C.default.inline,
    _namespace_identifier,
  ],

  precedences: [
    [argument_list, type_qualifier],
    [_expression_not_binary, _class_name],
  ],
};
