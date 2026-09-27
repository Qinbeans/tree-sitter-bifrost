/**
 * @file Bifrost grammar for tree-sitter
 * @author Ryan Fong <ryan.lawrence.fong@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check


/**
 * Optionally separated by commas
 * @param {Rule} rule
 * @returns
 */
const commaSep = (rule) => {
  return optional(commaSep1(rule));
}

/**
 * One or more, separated by commas
 * @param {Rule} rule
 * @returns
 */
const commaSep1 = (rule) => {
  return seq(rule, repeat(seq(",", rule)));
}

/** Separated by periods
 * @param {Rule} rule
 * @returns
 */
const periodSep2 = (rule) => {
  return seq(rule, ".", rule, repeat(seq(".", rule)));
}


export default grammar({
  name: "bifrost",

  // Comments may appear anywhere whitespace can.
  extras: ($) => [/\s/, $.comment],

  // Keywords only match whole words, so `window_width` never lexes as `w`,
  // `in`, `dow`, `_width` (which error recovery otherwise tries).
  word: ($) => $.simple_identifier,

  conflicts: ($) => [
    [$.assignment, $.getter_owner],
    [$.function_definition, $.getter_owner],
    [$.expression, $.user_function_call],
  ],

  rules: {
    source_file: ($) =>
      seq(
        repeat(choice($.function_definition, $.assignment)),
      ),

    list_type: ($) => seq($.type_or_object, "[]"),

    tuple_type: ($) =>
      seq("<", $.type_or_object, ",", commaSep1($.type_or_object), ">"),

    function_type: ($) =>
      prec(
        2,
        seq(
          // Higher precedence to function_type
          "fn",
          field("parameters", $.parameter_list),
          ":",
          field("return_type", $.type_or_object),
        ),
      ),

    module: ($) => seq("module", $.identifier, "=", $.block_expression),

    // `let x: T` is a stored field; `let f = (...) => ...` a function of the
    // object; `static let f = ...` one called on the type (`Context.new()`).
    struct_field: ($) => seq(
      optional(field("modifier", "static")),
      "let",
      $.identifier,
      choice(
        seq(":", $.type_or_object),
        seq(
          optional(
            seq(":", $.type_or_object)
          ),
          "=",
          $.local_function_definition
        )
      )
    ),

    struct_assignment: ($) => seq("struct", seq("{", commaSep($.struct_field), "}")),

    statement: ($) => choice($.expression),

    assignment: ($) =>
      seq(
        "let",
        $.identifier,
        "=",
        choice($.expression, $.block_expression, $.function_definition, $.struct_assignment),
      ),

    local_assignment: ($) =>
      seq(
        "let",
        $.identifier,
        "=",
        choice($.expression, $.block_expression, $.local_function_definition),
      ),

    function_definition: ($) =>
      seq(
        optional($.dependency_list),
        $.parameter_list,
        "=>",
        $.type_or_object, // Return type
        choice($.expression, $.block_expression),
      ),

    local_function_definition: ($) =>
      seq(
        optional($.local_dependency_list),
        $.parameter_list,
        "=>",
        $.type_or_object, // Return type
        choice($.expression, $.block_expression),
      ),

    dependency_list: ($) =>
      // `[]` is allowed and means the same as no list: no dependencies.
      seq("[", commaSep(choice($.identifier, $.child_annotation, "this")), "]"),

    local_dependency_list: ($) =>
      seq("[", commaSep(choice($.identifier, $.child_annotation, "this", "super")), "]"),

    parameter_list: ($) => seq("(", commaSep($.parameter), ")"),

    parameter: ($) => seq($.identifier, ":", $.type_or_object),

    null: ($) => "null",

    type: ($) =>
      prec(
        1,
        choice(
          $.list_type,
          $.tuple_type,
          $.function_type,
          $.pointer_type,
          "i8",
          "i16",
          "i32",
          "i64",
          "u8",
          "u16",
          "u32",
          "u64",
          "f32",
          "f64",
          "bool",
          "str",
          "h8",
          "h16",
          "h32",
          "h64",
          "o8",
          "o16",
          "o32",
          "o64",
          "b8",
          "b16",
          "b32",
          "b64",
          $.null,
        ),
      ),

    type_or_object: ($) =>
      prec(2, choice($.type, $.identifier, $.child_annotation)),

    ellipsis: ($) => "...",

    spread_between: ($) => seq($.expression, $.ellipsis, $.expression),

    spread_action: ($) => seq($.ellipsis, $.expression),

    rest_of: ($) => seq($.expression, $.ellipsis),

    builtin: ($) =>
      choice(
        "hex",
        "oct",
        "bin",
        "exit",
        "panic",
        "assert",
        "len",
        "export",
        "import",
      ),

    forall: ($) =>
      seq("forall", $.identifier, "in", $.expression, $.block_expression),

    return_statement: ($) => prec.right(seq("return", optional($.expression))),

    block_expression: ($) =>
      seq(
        "{",
        repeat(
          choice(
            $.expression,
            $.local_assignment,
            $.return_statement,
            $.lock,
            $.release,
            $.field_assignment,
          ),
        ),
        "}",
      ),

    // `let guard <- ctx`: lock ctx; the guard is the only way to reach it
    // until `guard -> ctx` releases it, in the same scope or a child scope.
    lock: ($) =>
      seq("let", field("guard", $.identifier), "<-", field("source", $.expression)),

    release: ($) =>
      seq(field("guard", $.identifier), "->", field("source", $.expression)),

    // `guard.counter = value`: fields change only through a guard.
    field_assignment: ($) =>
      seq(field("target", $.child_annotation), "=", field("value", $.expression)),

    // `ptr[] Context`: a pointer, with its guards in brackets (`ptr[own] File`).
    pointer_type: ($) =>
      prec.right(
        seq("ptr", "[", commaSep(field("guard", $.identifier)), "]", field("target", $.type_or_object)),
      ),

    getter_owner: ($) => $.expression,

    get_expression: ($) =>
      seq($.getter_owner, "[", choice($.expression, $.rest_of), "]"),


    while: ($) =>
      seq("while", $.expression, $.block_expression),

    if: ($) =>
      seq(
        "if",
        $.expression,
        $.block_expression,
        optional(
          seq(
            "else",
            choice($.block_expression, $.if),
          ),
        ),
      ),

    expression: ($) =>
      choice(
        $.match_expression,
        $.binary_expression,
        $.unary_expression,
        $.function_call,
        $.literal,
        $.identifier,
        $.child_annotation,
        $.get_expression,
        $.forall,
        $.while,
        $.if,
        $.default_var,
        $.parenthesized_expression,
      ),

    child_annotation: ($) =>
      prec(2, periodSep2(choice($.simple_identifier, $.function_call))),

    match_expression: ($) =>
      seq("match", $.expression, "{", commaSep1($.match_arm), "}"),

    default_var: ($) => "_",

    match_arm: ($) =>
      seq(
        $.condition,
        ":",
        choice($.expression, $.block_expression, $.return_statement),
      ),

    condition: ($) => $.expression,

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    // Higher binds tighter, as in C (with `**` above the unary operators, as
    // in Python, so `-a ** b` is `-(a ** b)`).
    binary_expression: ($) =>
      choice(
        ...[
          // Logical OR
          ["||", 1],
          // Logical AND
          ["&&", 2],
          // Bitwise inclusive (normal) OR
          ["|", 3],
          // Bitwise exclusive OR (XOR)
          ["^", 4],
          // Bitwise AND
          ["&", 5],
          // Comparisons: equal and not equal
          ["==", 6],
          ["!=", 6],
          // Comparisons: less-than and greater-than
          ["<", 7],
          ["<=", 7],
          [">", 7],
          [">=", 7],
          // Bitwise shift left and right
          ["<<", 8],
          [">>", 8],
          // Addition and subtraction
          ["+", 9],
          ["-", 9],
          // Multiplication, division, modulo
          ["*", 10],
          ["/", 10],
          ["%", 10],
        ].map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $.expression),
              field("operator", operator.toString()),
              field("right", $.expression),
            ),
          ),
        ),
        // Power is right-associative: `a ** b ** c` is `a ** (b ** c)`.
        prec.right(
          13,
          seq(
            field("left", $.expression),
            field("operator", "**"),
            field("right", $.expression),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(
        12,
        seq(
          field("operator", choice("-", "!")),
          field("argument", $.expression),
        ),
      ),

    function_call: ($) => choice($.builtin_call, $.user_function_call),

    builtin_call: ($) =>
      seq(
        field("function", $.builtin),
        field("arguments", seq("(", commaSep($.expression), ")")),
      ),

    user_function_call: ($) =>
      seq(
        field("function", $.identifier),
        field("arguments", seq("(", commaSep(choice($.expression, $.named_argument)), ")")),
      ),

    // `Context(window_width: 800)`: an argument given by name.
    named_argument: ($) =>
      seq(field("name", $.identifier), ":", field("value", $.expression)),

    literal: ($) =>
      choice($.number, $.boolean, $.string, $.list, $.tuple, $.record, $.null),

    number: ($) => choice($.integer, $.float, $.hex, $.oct, $.bin),

    integer: ($) => /[0-9]+/,
    hex: ($) => /0x[0-9a-fA-F]+/,
    oct: ($) => /0o[0-7]+/,
    bin: ($) => /0b[01]+/,
    float: ($) => /[0-9]+\.[0-9]+/,
    list: ($) =>
      seq(
        "#[",
        commaSep(choice($.expression, $.spread_between, $.spread_action)),
        "]",
      ),

    record_field: ($) =>
      seq($.identifier, choice(":", seq("?", ":")), $.type_or_object),
    record: ($) => seq("#{", commaSep($.record_field), "}"),
    tuple: ($) => seq("#(", commaSep($.expression), ")"),
    boolean: ($) => choice("true", "false"),
    string: ($) => /"[^"]*"/,
    simple_identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    // Above child_annotation's segments, so `a.f(x)` is a call rather than
    // `a.f` followed by the parenthesized `(x)`.
    identifier: ($) => prec(3, $.simple_identifier),
    comment: ($) =>
      choice(
        token(seq("//", /.*/)),
        // The pattern ends on the closing `*`, so only `/` follows it.
        token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),
  },
});
