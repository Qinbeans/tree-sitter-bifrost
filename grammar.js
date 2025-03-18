/**
 * @file Mimi grammar for tree-sitter
 * @author Ryan Fong <ryan.lawrence.fong@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "mimi",

  rules: {
    source_file: ($) =>
      seq(
        optional($.import_statement),
        repeat(choice($.statement, $.assignment, $.comment)),
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

    module: ($) => seq("Module", "{", commaSep1($.record_field), "}"),

    export_statement: ($) => seq("<-", "let", $.identifier, "=", $.module),

    import_statement: ($) => seq("import", $.identifier, "from", $.string),

    statement: ($) => choice($.export_statement, $.expression),

    assignment: ($) =>
      seq(
        "let",
        $.identifier,
        "=",
        choice($.expression, $.block_expression, $.function_definition),
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
        ":",
        $.type_or_object, // Return type
        "=>",
        choice($.expression, $.block_expression),
      ),

    local_function_definition: ($) =>
      seq(
        optional($.local_dependency_list),
        $.parameter_list,
        ":",
        $.type_or_object, // Return type
        "=>",
        choice($.expression, $.block_expression),
      ),

    dependency_list: ($) =>
      seq("[", commaSep1(choice($.identifier, "this")), "]"),

    local_dependency_list: ($) =>
      seq("[", commaSep1(choice($.identifier, "this", "super")), "]"),

    parameter_list: ($) => seq("(", commaSep($.parameter), ")"),

    parameter: ($) => seq($.identifier, ":", $.type_or_object),

    type: ($) =>
      prec(
        1,
        choice(
          $.list_type,
          $.tuple_type,
          $.function_type,
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
          "string",
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
          "void",
          "null",
        ),
      ),

    type_or_object: ($) => prec(2, choice($.type, $.identifier)),

    ellipsis: ($) => "...",

    spread_between: ($) => seq($.expression, $.ellipsis, $.expression),

    spread_action: ($) => seq($.ellipsis, $.expression),

    rest_of: ($) => seq($.expression, $.ellipsis),

    builtin: ($) =>
      choice(
        "print",
        "println",
        "read",
        "readln",
        "hex",
        "oct",
        "bin",
        "exit",
        "panic",
        "assert",
        "len",
      ),

    forall: ($) =>
      seq("forall", $.identifier, "in", $.expression, $.block_expression),

    return_statement: ($) => seq("return", optional($.expression)),

    block_expression: ($) =>
      seq(
        "{",
        commaSep1(choice($.expression, $.local_assignment, $.return_statement)),
        "}",
      ),

    getter_owner: ($) => $.expression,

    get_expression: ($) =>
      seq($.getter_owner, "[", choice($.expression, $.rest_of), "]"),

    expression: ($) =>
      choice(
        $.match_expression,
        $.binary_expression,
        $.unary_expression,
        $.function_call,
        $.literal,
        $.identifier,
        $.record_expression,
        $.child_annotation,
        $.get_expression,
        $.forall,
        $.default_var,
      ),

    child_annotation: ($) =>
      prec(2, periodSep2(choice($.identifier, $.function_call))),

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

    binary_expression: ($) =>
      choice(
        ...[
          // Power operator
          ["**", 4],
          // Multiplication, division, modulo
          ["*", 3],
          ["/", 3],
          ["%", 3],
          // Addition and subtraction
          ["+", 2],
          ["-", 2],
          // Bitwise shift left and right
          ["<<", 5],
          [">>", 5],
          // Comparisons: less-than and greater-than
          ["<", 6],
          ["<=", 6],
          [">", 6],
          [">=", 6],
          // Comparisons: equal and not equal
          ["==", 7],
          ["!=", 7],
          // Bitwise AND
          ["&", 8],
          // Bitwise exclusive OR (XOR)
          ["^", 9],
          // Bitwise inclusive (normal) OR
          ["|", 10],
          // Logical AND
          ["&&", 11],
          // Logical OR
          ["||", 12],
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
      ),

    unary_expression: ($) =>
      prec(
        13,
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
        field("arguments", seq("(", commaSep($.expression), ")")),
      ),

    literal: ($) =>
      choice($.number, $.boolean, $.string, $.list, $.tuple, $.record, "null"),

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
    optional_field: ($) =>
      seq($.identifier, "?", ":", choice($.expression, $.type_or_object)),
    record_field: ($) =>
      seq(
        $.identifier,
        ":",
        choice($.expression, $.type_or_object, $.function_definition),
      ),
    record_expression: ($) =>
      prec.left(
        1,
        seq(
          "Record",
          "{",
          commaSep1(choice($.record_field, $.optional_field)),
          "}",
          optional(
            seq(choice("&", "|"), choice($.identifier, $.record_expression)),
          ),
        ),
      ),
    record: ($) =>
      seq("#{", commaSep(choice($.record_field, $.spread_action)), "}"),
    tuple: ($) => seq("#(", commaSep($.expression), ")"),
    boolean: ($) => choice("true", "false"),
    string: ($) => /"[^"]*"/,
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    comment: ($) =>
      choice(
        token(seq("//", /.*/)),
        token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "*/")),
      ),
  },
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function periodSep2(rule) {
  return seq(rule, ".", rule, repeat(seq(".", rule)));
}
