lib_name = tree_sitter_mimi
suffix = .a
rm_cmd = rm -f

ifeq ($(OS),Windows_NT)
    suffix = .lib
    rm_cmd = del
endif

lib_path = $(lib_name)$(suffix)

build:
	@echo "Building $(lib_name)..."
	pushd .. && tree-sitter generate --abi 14 && popd
	clang -c ../src/parser.c -o parser.o
	ar rcs $(lib_path) parser.o

clean:
	@echo "Cleaning $(lib_name)..."
	$(rm_cmd) parser.o
	$(rm_cmd) $(lib_path)
