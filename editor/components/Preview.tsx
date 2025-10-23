import { useEffect, useRef } from "react";
import { useNodeNetworkStore } from "../lib/state.ts";
import { Spinner } from "./ui/spinner.tsx";
import { useDimenstions } from "../hooks/useDimensions.ts";
import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value?: number;
}

export const RADIUS = 30;
function nodeColor(d: Node) {
  switch (d.id) {
    case "start":
      return "#4ade80"; // green
    case "end":
      return "#f87171"; // red
    default:
      return "#cb1dd1"; // purple
  }
}
export default function Preview() {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dimentions = useDimenstions(ref);
  const network = useNodeNetworkStore((state) => state.network);
  const loading = useNodeNetworkStore((state) => state.loading);

  console.log(network);
  useEffect(() => {
    if (!network || !dimentions) return;
    const { width, height } = dimentions;

    // Remove duplicates and fix invalid links safely
    const nodeMap = new Map(network.nodes.map((n) => [n.id, n]));
    const nodes: Node[] = Array.from(nodeMap.values());

    // Filter links that reference missing nodes
    const links: Link[] = network.links
      .filter((l) => {
        const valid =
          nodeMap.has(l.source as string) && nodeMap.has(l.target as string);
        if (!valid) {
          console.warn(`⚠️ Skipping invalid link:`, l);
        }
        return valid;
      })
      .map((l) => ({ ...l }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const linkLayer = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6);
    const nodeLayer = svg.append("g");

    const linkSelection = linkLayer
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-width", 2);

    const nodeColor = (d: Node) => {
      switch (d.id) {
        case "start":
          return "#4CAF50";
        case "ending":
          return "#f44336";
        default:
          return "#cb1dd1";
      }
    };

    const adjacency = new Map<string, Set<string>>();
    links.forEach((l) => {
      const src = (l.source as Node).id || (l.source as string);
      const tgt = (l.target as Node).id || (l.target as string);
      if (!adjacency.has(src)) adjacency.set(src, new Set());
      if (!adjacency.has(tgt)) adjacency.set(tgt, new Set());
      adjacency.get(src)!.add(tgt);
      adjacency.get(tgt)!.add(src);
    });

    const nodeG = nodeLayer
      .selectAll<SVGGElement, Node>("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .classed("node", true)
      .style("cursor", "pointer");

    nodeG
      .append("circle")
      .attr("r", RADIUS)
      .attr("fill", nodeColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodeG
      .append("text")
      .text((d) => d.id)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "16px")
      .attr("font-family", "Helvetica")
      .attr("fill", "#000")
      .style("pointer-events", "none");

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink<Node, Link>(links).id((d) => d.id),
      )
      .force("charge", d3.forceManyBody())
      .force("collide", d3.forceCollide().radius(RADIUS * 2))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const drag = d3
      .drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeG.call(drag);

    nodeG
      .on("mouseenter", (event, hoveredNode) => {
        const connected = adjacency.get(hoveredNode.id) ?? new Set();
        nodeG.select("circle").attr("fill", (d) => {
          if (d.id === hoveredNode.id) return "#ff69b4";
          if (connected.has(d.id)) return "#ffc0cb";
          return nodeColor(d);
        });

        linkSelection
          .attr("stroke", (l) =>
            (l.source as Node).id === hoveredNode.id ||
            (l.target as Node).id === hoveredNode.id
              ? "#ff69b4"
              : "#ccc",
          )
          .attr("stroke-opacity", (l) =>
            (l.source as Node).id === hoveredNode.id ||
            (l.target as Node).id === hoveredNode.id
              ? 1
              : 0.2,
          );
      })
      .on("mouseleave", () => {
        nodeG.select("circle").attr("fill", nodeColor);
        linkSelection.attr("stroke", "#999").attr("stroke-opacity", 0.6);
      });

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);

      nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [network, dimentions]);

  return (
    <div className="h-full w-full" ref={ref}>
      {loading && <Spinner />}
      <svg
        ref={svgRef}
        width={dimentions?.width}
        height={dimentions?.height}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
