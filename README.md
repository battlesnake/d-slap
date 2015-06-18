D-SLAP
======

Domain-specific languages and parsers

This README contains brief summaries.  For more information, look at the
documentation in the source files for the parsers, or see the unit tests.

Simple parser
-------------

Parses expressions consisting of:

 * Entities - an entity is a single character

 * Groups - a group is contained within a start character and an end character.
   The contents of a group may include other entities and groups.

The comprehension parser uses the simple parser.  Syntax specifications for
comprehensions are given as expressions in the comprehension language.

Comprehension language and parser
---------------------------------

The comprehension language defines a way to specify comprehension syntaxes.
A comprehension syntax is parsed against this specification using the simple
parser.  The comprehension parser is a factory which returns a generated parser,
given a language specification.  The parser uses a regular expression, so should
perform very well as the actual string parsing is done by native code.

Comprehensions may consist of keywords and named capture groups.  They may be
nested within subgroups to provide choices or to make them optional.

The associated unit test demonstrates using this engine to parse AngularJS-like
ngOptions comprehension expressions.

Recursive parser
----------------

Specialised for parsing languages that permit recursive nesting.  Group start
and end markers, and entities may consist of multiple characters.

This parser is capable of backtracking if the "backtrack" option is set.

This parser is used by the arithmetic evaluator

Arithmetic parser, language, and evaluator
------------------------------------------

The arithmetic language is a JavaScript-like language which supports members,
subscripts, function calls, and most other JavaScript operators that do not
cause side effects (so no =/++/--).

The arithmetic parser parses an expression that conforms to the arithmetic
language.  It transforms the parse tree to an expression tree and returns a
function which (when given a context) will apply the expression to the context
and return the result.  If the expression identifies a variable, then it is also
possible to assign to the variable that the expression refers to.

The expression tree provides a chain of functions that evaluate each part of
the expression, feeding their result to functions higher in the chain.  Hence,
while parsing an expression may be slow, subsequently evaluating the expression
in a given context is fast (as is assignment).

Assigning directly to properties of the context will not work unless the
"rawScope" option is set.  Attempts to access a non-existant context-level
variable will result in an exception unless the "notStrict" option is set.
