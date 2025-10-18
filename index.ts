import { Lexer } from "./dsl/lexer.ts";

const source = `
node start
  say "Hello, #{@player_name}!"
  @met_player = true
  
  choice "Continue", :next
  choice "Shop", :shop, if: @gold >= 10
  choidce "Die!", :end, if: random(0, 10) < 0.1
end
`;
const lexer = new Lexer(source);
const tokens = Array.from(lexer.tokenize());
console.log(tokens);
