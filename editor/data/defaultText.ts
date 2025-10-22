export const text = `node start
  say "Welcome to the adventure!"
  say "You have #{@gold} gold and #{@health} HP."

  if !@visited_start
    say "This is your first visit here."
    if @level < 3
      say "You feel inexperienced."
    else
      say "You feel ready for challenges."
      if @level >= 10
        say "You are a seasoned adventurer!"
      end
    end
  end
  
  @visited_start = true
  @visit_count = @visit_count + 1
  
  choice "Go to shop", :shop
  choice "Go to forest", :forest, if: @level >= 5
  choice "Rest at inn", :inn, if: @gold >= 20 && @health < 100
  choice "Check inventory", :inventory, if: !@inventory_empty
  choice "Quit", :ending
end
`;
