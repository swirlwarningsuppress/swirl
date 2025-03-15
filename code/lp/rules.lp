predict_pos(A) :- rule_containment(X), containment(A, X), not used_for_composite_rule(X).
predict_pos(A) :- rule_containment2(X, Y), containment(A, X), containment(A, Y).

0 { rule_containment(X) : containment(_, X) } 10.

true_positive(A) :- predict_pos(A), pos(A).
false_positive(A) :- predict_pos(A), neg(A).


0 { rule_containment2(X, Y) : specialize_containment(X), containment(_, Y) } 5.


used_for_composite_rule(X) :- rule_containment2(X, _).
used_for_composite_rule(X) :- rule_containment2(_, X).


num_rules(N) :- N = #count{ A : rule_containment(A) }.
num_true_positive(N) :- N = #count{ A : true_positive(A) }.
num_false_positive(N) :- N = #count{ A : false_positive(A) }.
num_predict_pos(N) :- N = #count{ A : predict_pos(A) }.

#maximize { N@3 : num_true_positive(N), N >= 0 }.
#minimize { N@3: num_false_positive(N) }.
#minimize { N@2 : num_rules(N), N >= 0 }.
#maximize { N@1 : num_predict_pos(N), N >= 0 }.


#show pos/1.
#show neg/1.
#show true_positive/1.
#show false_positive/1.
#show rule_containment/1.
#show rule_containment2/2.
#show specialize_containment/1.
#show num_rules/1.
#show num_true_positive/1.
