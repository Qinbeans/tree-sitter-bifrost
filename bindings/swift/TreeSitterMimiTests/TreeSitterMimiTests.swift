import XCTest
import SwiftTreeSitter
import TreeSitterMimi

final class TreeSitterMimiTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_mimi())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Mimi grammar")
    }
}
