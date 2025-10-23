import XCTest
import SwiftTreeSitter
import TreeSitterTome

final class TreeSitterTomeTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_tome())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Tome grammar")
    }
}
