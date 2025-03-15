% for frozen rules, constraint the inference

rule_contains0(X) :- fixed_rule_contains0(X).
rule_contains1(X) :- fixed_rule_contains1(X).
rule_contains2(X) :- fixed_rule_contains2(X).
rule_contains3(X) :- fixed_rule_contains3(X).
rule_contains4(X) :- fixed_rule_contains4(X).
rule_contains5(X) :- fixed_rule_contains5(X).

% for each rule, pick several containments,
0 { rule_contains0(X) : containment(_, X) } 3.

0 { rule_contains1(X) : containment(_, X) } 3.

0 { rule_contains2(X) : containment(_, X) } 3.

0 { rule_contains3(X) : containment(_, X) } 3.

% 0 { rule_contains4(X) : containment(_, X) } 3.




rule_predict_neg_for_missing_containment(A, X) :- rule_contains0(X), not containment(A, X), example(A).
rule_predict_neg(A) :- rule_predict_neg_for_missing_containment(A, _).
rule_predict_pos(A) :- not rule_predict_neg(A), example(A), rule_contains0(_).

rule_predict_neg_for_missing_containment1(A, X) :- rule_contains1(X), not containment(A, X), example(A).
rule_predict_neg1(A) :- rule_predict_neg_for_missing_containment1(A, _).
rule_predict_pos1(A) :- not rule_predict_neg1(A), example(A), rule_contains1(_).

rule_predict_neg_for_missing_containment2(A, X) :- rule_contains2(X), not containment(A, X), example(A).
rule_predict_neg2(A) :- rule_predict_neg_for_missing_containment2(A, _).
rule_predict_pos2(A) :- not rule_predict_neg2(A), example(A), rule_contains2(_).


rule_predict_neg_for_missing_containment3(A, X) :- rule_contains3(X), not containment(A, X), example(A).
rule_predict_neg3(A) :- rule_predict_neg_for_missing_containment3(A, _).
rule_predict_pos3(A) :- not rule_predict_neg3(A), example(A), rule_contains3(_).


rule_predict_neg_for_missing_containment4(A, X) :- rule_contains4(X), not containment(A, X), example(A).
rule_predict_neg4(A) :- rule_predict_neg_for_missing_containment4(A, _).
rule_predict_pos4(A) :- not rule_predict_neg4(A), example(A), rule_contains4(_).

rule_predict_neg_for_missing_containment5(A, X) :- rule_contains5(X), not containment(A, X), example(A).
rule_predict_neg5(A) :- rule_predict_neg_for_missing_containment5(A, _).
rule_predict_pos5(A) :- not rule_predict_neg5(A), example(A), rule_contains5(_).

% something is true positive if it is positive and any rule predicts positive

true_positive(A) :- pos(A), rule_predict_pos(A).
true_positive(A) :- pos(A), rule_predict_pos1(A).
true_positive(A) :- pos(A), rule_predict_pos2(A).
true_positive(A) :- pos(A), rule_predict_pos3(A).
true_positive(A) :- pos(A), rule_predict_pos4(A).
true_positive(A) :- pos(A), rule_predict_pos5(A).

% something is false positive if it is negative and any rule predicts positive
false_positive(A) :- neg(A), rule_predict_pos(A).
false_positive(A) :- neg(A), rule_predict_pos1(A).
false_positive(A) :- neg(A), rule_predict_pos2(A).
false_positive(A) :- neg(A), rule_predict_pos3(A).
false_positive(A) :- neg(A), rule_predict_pos4(A).
false_positive(A) :- neg(A), rule_predict_pos5(A).



num_true_positive(N) :- N = #count{ A : true_positive(A) }.
num_false_positive(N) :- N = #count{ A : false_positive(A) }.
num_predict_pos(N) :- N = #count{ A : rule_predict_pos(A) }.


contained_in_any_rule(T) :- T  =  #count { (0,A) : rule_contains0(A); (1, B) : rule_contains1(B); (2, C): rule_contains2(C); (3, D): rule_contains3(D); (4, E): rule_contains4(E); (5, F): rule_contains4(F)}.
    

#maximize { N@3 : num_true_positive(N), N > 0 }.
#minimize { N@4 : num_false_positive(N) }.
#minimize { N@2 : contained_in_any_rule(N), N >= 0 }.
#maximize { N@1 : num_predict_pos(N), N >= 0 }.


#show pos/1.
#show neg/1.
#show true_positive/1.
#show false_positive/1.
#show rule_contains0/1.
#show rule_contains1/1.
#show rule_contains2/1.
#show rule_contains3/1.
#show rule_contains4/1.
#show rule_contains5/1.
#show rule_contains6/1.
#show num_true_positive/1.
#show num_false_positive/1.
#show contained_in_any_rule/1.
#show rule_predict_pos/1.
#show rule_predict_pos1/1.
#show rule_predict_pos2/1.
#show rule_predict_pos3/1.
#show rule_predict_pos4/1.
#show rule_predict_pos5/1.




