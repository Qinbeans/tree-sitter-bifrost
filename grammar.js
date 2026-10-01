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
    [$.expression, $.user_function_call],
    // `let f = [...] (...) => ...` at the top level: a definition (see
    // function_definition's dynamic precedence), not a lambda.
    [$.dependency_list, $.local_dependency_list],
    [$.function_definition, $.local_function_definition],
    // After a function's `=>`, `(a: T) => R`: its result's type (see function_type).
    [$.function_type, $.parameter_list],
  ],

  rules: {
    source_file: ($) =>
      seq(
        repeat(choice($.function_definition, $.assignment, $.module, $.export_statement)),
      ),

    list_type: ($) => seq($.type_or_object, "[]"),

    tuple_type: ($) =>
      seq("<", $.type_or_object, ",", commaSep1($.type_or_object), ">"),

    // `(ctx: http.Context) => null`, or `(i32) => i32`: the type of a function
    // value, written like a definition's head. Parameter names are optional.
    // After a function's `=>`, `(...) => T` is its result's type (a function
    // type), not a lambda as its body: `(a: i64) => () => i64 { ... }`.
    function_type: ($) =>
      prec.dynamic(
        1,
        prec.right(
          seq(
          "(",
          commaSep(field("parameter", choice($.parameter, $.type_or_object))),
          ")",
          "=>",
            field("return_type", $.type_or_object),
          ),
        ),
      ),

    // `module helper = { let greet = ... }`: a named group of `let`s. A block
    // comment at its top is its description.
    module: ($) =>
      seq("module", field("name", $.identifier), "=", "{", repeat(field("member", $.assignment)), "}"),

    // `export(helper)`: modules other files may import, as `import("file:helper")`.
    export_statement: ($) => seq("export", "(", commaSep1(field("module", $.identifier)), ")"),

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
        optional(seq(":", field("type", $.type_or_object))),
        "=",
        choice($.expression, $.block_expression),
      ),

    function_definition: ($) =>
      prec.dynamic(
        1,
        seq(
          optional($.dependency_list),
          optional(field("async", "async")),
          $.parameter_list,
          "=>",
          $.type_or_object, // Return type
          choice($.expression, $.block_expression),
        ),
      ),

    // Also a lambda: a function written where a value goes, e.g. passed as
    // an argument, `http.get(app, "/", [http.text] (ctx: http.Context) => null { ... })`.
    local_function_definition: ($) =>
      prec.right(
        seq(
          optional($.local_dependency_list),
          optional(field("async", "async")),
          $.parameter_list,
          "=>",
          $.type_or_object, // Return type
          choice($.expression, $.block_expression),
        ),
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

    // `mem.Shared[Context]`: a type applied to type arguments.
    // Binds before a lambda's `[deps]` could start: `=> mem.Weak[C] c` returns
    // a mem.Weak[C].
    generic_type: ($) =>
      prec(
        3,
        seq(
          field("base", choice($.identifier, $.child_annotation)),
          "[",
          commaSep1(field("argument", $.type_or_object)),
          "]",
        ),
      ),

    type_or_object: ($) =>
      prec(2, choice($.type, $.generic_type, $.identifier, $.child_annotation, $.record_type)),

    // A record's type: `#{name: str, ms: i64}` (records with the same fields share it).
    record_type_field: ($) => seq(field("name", $.identifier), ":", field("type", $.type_or_object)),
    record_type: ($) => seq("#{", commaSep1($.record_type_field), optional(","), "}"),

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
            $.guard_assignment,
          ),
        ),
        "}",
      ),

    // `let guard <- ctx`: lock ctx; the guard is the only way to reach it
    // until `guard -> ctx` releases it, in the same scope or a child scope.
    lock: ($) =>
      seq(
        "let",
        field("guard", $.identifier),
        optional(seq(":", field("type", $.type_or_object))),
        "<-",
        field("source", $.expression),
      ),

    release: ($) =>
      seq(field("guard", $.identifier), "->", field("source", $.expression)),

    // `guard.counter = value`: fields change only through a guard.
    // `guard.f = v`, `guard[i] = v`, `guard.items[i].f = v`: change part of what a guard holds.
    field_assignment: ($) =>
      seq(field("target", choice($.child_annotation, $.get_expression)), "=", field("value", $.expression)),

    // `guard = guard + 1`: write the whole value a guard holds, e.g. a mem.Atomic[i64].
    guard_assignment: ($) =>
      seq(field("guard", $.identifier), "=", field("value", $.expression)),

    // `x[i]` binds tightest (`a + b[i]` is `a + (b[i])`), and never means `x`
    // followed by a lambda's `[deps]`.
    getter_owner: ($) => prec(14, $.expression),

    // `xs[i]`, or a slice: `xs[a...b]`, `xs[a...]`, `xs[...b]`.
    get_expression: ($) =>
      seq($.getter_owner, "[", choice($.expression, $.rest_of, $.spread_between, $.spread_action), "]"),


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
        $.await_expression,
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
        $.local_function_definition,
      ),

    // `a.b`, `a.f(x).c`, or reading on from an item: `users[0].name`.
    child_annotation: ($) =>
      prec(
        2,
        seq(
          choice($.simple_identifier, $.function_call, $.get_expression),
          repeat1(seq(".", choice($.simple_identifier, $.function_call))),
        ),
      ),

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

    // `await http.sleep(ms)`: wait for a call that pauses, in an async function.
    await_expression: ($) => prec(12, seq("await", field("value", $.expression))),

    function_call: ($) => choice($.builtin_call, $.user_function_call),

    builtin_call: ($) =>
      seq(
        field("function", $.builtin),
        field("arguments", seq("(", commaSep($.expression), ")")),
      ),

    // `f(x)` in a block could also read as two statements, `f` then `(x)`;
    // the dynamic precedence always picks the call.
    user_function_call: ($) =>
      prec.dynamic(
        1,
        seq(
          field("function", $.identifier),
          field("arguments", seq("(", commaSep(choice($.expression, $.named_argument)), ")")),
        ),
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

    // `#{id: 7, name: "user 7"}`: a record, a value with named fields.
    record_field: ($) => seq(field("name", $.identifier), ":", field("value", $.expression)),
    record: ($) => seq("#{", commaSep($.record_field), "}"),
    tuple: ($) => seq("#(", commaSep($.expression), ")"),
    boolean: ($) => choice("true", "false"),
    // `"Hello, {name}!"`: text, escapes (`\"`, `\n`; the compiler decodes them),
    // `{{` and `}}` for braces, and `{expression}` or `{expression:spec}` (a printf
    // conversion, `{price:.2f}`), which the compiler interpolates.
    string: ($) =>
      seq(
        '"',
        repeat(choice($.string_text, $.string_escape, $.string_brace, $.interpolation)),
        token.immediate('"'),
      ),
    string_text: ($) => token.immediate(prec(1, /[^"\\{}\n]+/)),
    string_escape: ($) => token.immediate(/\\(x[0-9a-fA-F]{2}|.)/),
    string_brace: ($) => token.immediate(choice("{{", "}}")),
    interpolation: ($) =>
      seq(
        token.immediate("{"),
        field("value", $.expression),
        optional(seq(token.immediate(":"), field("format", $.format_spec))),
        "}",
      ),
    format_spec: ($) => token.immediate(/[^}"\n]+/),
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
