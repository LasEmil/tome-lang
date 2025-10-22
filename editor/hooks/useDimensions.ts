import { useEffect, useState, type RefObject } from "react";
import debounce from "lodash.debounce";

export const useDimenstions = (ref: RefObject<HTMLElement | null>) => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!ref.current) return;

    const handleResize = debounce((entries) => {
      const entry = entries[0];
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    }, 50);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
      handleResize.cancel();
    };
  }, [ref]);

  return dimensions;
};
