package tree_sitter_calcit_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_calcit "github.com/qinbeans/calcit/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_calcit.Language())
	if language == nil {
		t.Errorf("Error loading Calcit grammar")
	}
}
