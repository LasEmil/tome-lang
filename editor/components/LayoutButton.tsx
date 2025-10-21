import { ToggleGroupItem } from "./ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";
import { useLayoutState } from "../lib/state";

type LayoutButtonProps = {
  name: string;
  iconOn: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconOff: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};
const LayoutButton = ({ name, iconOn, iconOff }: LayoutButtonProps) => {
  const toggled = useLayoutState((state) => state.panels[name].value);
  const IconOn = iconOn;
  const IconOff = iconOff;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          value={name}
          className={cn("cursor-pointer", {
            "bg-accent text-accent-foreground hover:bg-accent/90": toggled,
            "hover:bg-secondary/50": !toggled,
          })}
        >
          {toggled ? (
            <IconOn className="h-4 w-4" />
          ) : (
            <IconOff className="h-4 w-4" />
          )}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent>
        <p>{toggled ? `Close ${name} panel` : `Open ${name} panel`}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default LayoutButton;
