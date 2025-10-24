import { useEffect, useRef } from "react";
import { useNodeNetworkStore } from "../lib/state.ts";
import { Spinner } from "./ui/spinner.tsx";
import { useDimenstions } from "../hooks/useDimensions.ts";
import * as d3 from "d3";

interface Node {
  id: string;
  x: number;
  y: number;
  layer: number;
}

const RADIUS = 35;
const LAYER_HEIGHT = 150;
const NODE_SPACING = 180;
const TRANSITION_DURATION = 600;
const LAYER_STAGGER = 100;

function nodeColor(id: string) {
  switch (id) {
    case "start":
      return "#10b981"; // emerald
    case "end":
      return "#ef4444"; // red
    default:
      return "#a855f7"; // purple
  }
}

export default function Preview() {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dimentions = useDimenstions(ref);
  const edgeMap = useNodeNetworkStore((state) => state.edgeMap);
  const loading = useNodeNetworkStore((state) => state.loading);

  useEffect(() => {
    if (!edgeMap || !dimentions) return;
    const { width, height } = dimentions;

    // Build layered layout using BFS
    const layers: string[][] = [];
    const visited = new Set<string>();
    const nodeToLayer = new Map<string, number>();

    // Start from "start" node, or first node if "start" doesn't exist
    const startNode = edgeMap.has("start")
      ? "start"
      : Array.from(edgeMap.keys())[0];

    if (!startNode) return;

    let queue = [startNode];
    let currentLayer = 0;

    while (queue.length > 0) {
      const layerNodes = [...queue];
      queue = [];
      layers[currentLayer] = [];

      for (const nodeId of layerNodes) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        nodeToLayer.set(nodeId, currentLayer);
        layers[currentLayer].push(nodeId);

        const edge = edgeMap.get(nodeId);
        if (edge) {
          edge.outgoing.forEach((target) => {
            if (!visited.has(target)) {
              queue.push(target);
            }
          });
        }
      }

      if (queue.length > 0) currentLayer++;
    }

    // Add any disconnected nodes to the last layer
    edgeMap.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        if (!layers[currentLayer]) layers[currentLayer] = [];
        layers[currentLayer].push(nodeId);
        nodeToLayer.set(nodeId, currentLayer);
      }
    });

    // Position nodes
    const nodes: Node[] = [];
    layers.forEach((layer, layerIndex) => {
      const layerWidth = (layer.length - 1) * NODE_SPACING;
      const startX = (width - layerWidth) / 2;

      layer.forEach((nodeId, i) => {
        nodes.push({
          id: nodeId,
          x: startX + i * NODE_SPACING,
          y: 80 + layerIndex * LAYER_HEIGHT,
          layer: layerIndex,
        });
      });
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Build edge list with bidirectional detection
    const edgeSet = new Set<string>();
    const edges: Array<{
      source: Node;
      target: Node;
      bidirectional: boolean;
    }> = [];

    edgeMap.forEach((edge, sourceId) => {
      edge.outgoing.forEach((targetId) => {
        const source = nodeMap.get(sourceId);
        const target = nodeMap.get(targetId);
        if (!source || !target) return;

        const key1 = `${sourceId}->${targetId}`;
        const key2 = `${targetId}->${sourceId}`;

        if (edgeSet.has(key2)) {
          // Already added in opposite direction, mark as bidirectional
          const existing = edges.find(
            (e) => e.source.id === targetId && e.target.id === sourceId,
          );
          if (existing) existing.bidirectional = true;
        } else if (!edgeSet.has(key1)) {
          edgeSet.add(key1);
          const targetEdge = edgeMap.get(targetId);
          const isBidirectional = targetEdge?.outgoing.has(sourceId) ?? false;
          edges.push({ source, target, bidirectional: isBidirectional });
          if (isBidirectional) edgeSet.add(key2);
        }
      });
    });

    const svg = d3.select(svgRef.current);

    // Define arrow markers (only once)
    let defs = svg.select("defs");
    if (defs.empty()) {
      defs = svg.append("defs");

      const createMarker = (id: string, color: string) => {
        defs
          .append("marker")
          .attr("id", id)
          .attr("viewBox", "0 0 10 10")
          .attr("refX", 9)
          .attr("refY", 5)
          .attr("markerWidth", 6)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M 0 0 L 10 5 L 0 10 z")
          .attr("fill", color);
      };

      createMarker("arrowhead", "#64748b");
      createMarker("arrowhead-hover", "#ec4899");
    }

    // Get or create layers
    let edgeLayer = svg.select("g.edge-layer");
    if (edgeLayer.empty()) {
      edgeLayer = svg.append("g").attr("class", "edge-layer");
    }

    let nodeLayer = svg.select("g.node-layer");
    if (nodeLayer.empty()) {
      nodeLayer = svg.append("g").attr("class", "node-layer");
    }

    // Helper function to generate path
    const generatePath = (d: (typeof edges)[0]) => {
      const { source, target } = d;

      // Self-loop - smooth arc to the right side
      if (source.id === target.id) {
        const loopWidth = 70;
        const loopHeight = 70;
        const startAngle = -30 * (Math.PI / 180);
        const endAngle = 30 * (Math.PI / 180);

        const sx = source.x + Math.cos(startAngle) * RADIUS;
        const sy = source.y + Math.sin(startAngle) * RADIUS;
        const ex = source.x + Math.cos(endAngle) * RADIUS;
        const ey = source.y + Math.sin(endAngle) * RADIUS;

        const cx1 = source.x + loopWidth;
        const cy1 = source.y - loopHeight;
        const cx2 = source.x + loopWidth;
        const cy2 = source.y + loopHeight;

        return `M ${sx} ${sy}
                C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;
      }

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Adjust for node radius
      const offsetX = (dx / dist) * RADIUS;
      const offsetY = (dy / dist) * RADIUS;

      const sx = source.x + offsetX;
      const sy = source.y + offsetY;
      const tx = target.x - offsetX;
      const ty = target.y - offsetY;

      // Curved path
      const curvature = 0.3;
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;

      // Control point perpendicular to the line
      const perpX = -(ty - sy) * curvature;
      const perpY = (tx - sx) * curvature;

      const cx = midX + perpX;
      const cy = midY + perpY;

      return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
    };

    // Update edges with transitions
    const pathSelection = edgeLayer
      .selectAll<SVGPathElement, (typeof edges)[0]>("path")
      .data(edges, (d) => `${d.source.id}-${d.target.id}`)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("fill", "none")
            .attr("stroke", "#64748b")
            .attr("stroke-width", 2.5)
            .attr("stroke-opacity", 0)
            .attr("marker-end", "url(#arrowhead)")
            .attr("marker-start", (d) =>
              d.bidirectional ? "url(#arrowhead)" : null,
            )
            .attr("d", generatePath)
            .call((enter) =>
              enter
                .transition()
                .duration(TRANSITION_DURATION)
                .delay(
                  (d) =>
                    Math.max(d.source.layer, d.target.layer) * LAYER_STAGGER +
                    200,
                )
                .ease(d3.easeCubicOut)
                .attr("stroke-opacity", 0.6),
            ),
        (update) =>
          update.call((update) =>
            update
              .transition()
              .duration(TRANSITION_DURATION)
              .ease(d3.easeCubicOut)
              .attr("d", generatePath),
          ),
        (exit) =>
          exit.call((exit) =>
            exit
              .transition()
              .duration(TRANSITION_DURATION / 2)
              .ease(d3.easeCubicIn)
              .attr("stroke-opacity", 0)
              .remove(),
          ),
      );

    // Update nodes with transitions
    const nodeG = nodeLayer
      .selectAll<SVGGElement, Node>("g.node")
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .classed("node", true)
            .style("cursor", "pointer")
            .attr("transform", (d) => `translate(${d.x},${d.y})`);

          g.append("circle")
            .attr("r", 0)
            .attr("fill", (d) => nodeColor(d.id))
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 3)
            .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))")
            .attr("opacity", 0);

          g.append("text")
            .text((d) => d.id)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "14px")
            .attr("font-weight", "500")
            .attr("font-family", "system-ui, -apple-system, sans-serif")
            .attr("fill", "#ffffff")
            .style("pointer-events", "none")
            .attr("opacity", 0);

          return g.call((enter) =>
            enter
              .transition()
              .duration(TRANSITION_DURATION)
              .delay((d) => d.layer * LAYER_STAGGER)
              .ease(d3.easeBackOut.overshoot(1.2))
              .call((transition) => {
                transition
                  .select("circle")
                  .attr("r", RADIUS)
                  .attr("opacity", 1);
                transition.select("text").attr("opacity", 1);
              }),
          );
        },
        (update) =>
          update.call((update) =>
            update
              .transition()
              .duration(TRANSITION_DURATION)
              .ease(d3.easeCubicOut)
              .attr("transform", (d) => `translate(${d.x},${d.y})`),
          ),
        (exit) =>
          exit.call((exit) =>
            exit
              .transition()
              .duration(TRANSITION_DURATION / 2)
              .ease(d3.easeBackIn.overshoot(1.2))
              .call((transition) => {
                transition.select("circle").attr("r", 0).attr("opacity", 0);
                transition.select("text").attr("opacity", 0);
              })
              .remove(),
          ),
      );

    // Hover interactions
    nodeG
      .on("mouseenter", (event, hoveredNode) => {
        const edge = edgeMap.get(hoveredNode.id);
        const connected = new Set([
          ...(edge?.outgoing || []),
          ...(edge?.incoming || []),
        ]);

        nodeG.select("circle").attr("fill", (d) => {
          if (d.id === hoveredNode.id) return "#ec4899";
          if (connected.has(d.id)) return "#f472b6";
          return nodeColor(d.id);
        });

        pathSelection.each(function (e) {
          const isConnected =
            e.source.id === hoveredNode.id || e.target.id === hoveredNode.id;
          const elem = d3.select(this);

          elem
            .attr("stroke", isConnected ? "#ec4899" : "#cbd5e1")
            .attr("stroke-opacity", isConnected ? 1 : 0.2)
            .attr("stroke-width", isConnected ? 3 : 2.5);

          // Force marker update by removing and re-adding
          elem.attr("marker-end", null).attr("marker-start", null);
          elem
            .attr(
              "marker-end",
              isConnected ? "url(#arrowhead-hover)" : "url(#arrowhead)",
            )
            .attr(
              "marker-start",
              e.bidirectional
                ? isConnected
                  ? "url(#arrowhead-hover)"
                  : "url(#arrowhead)"
                : null,
            );
        });
      })
      .on("mouseleave", () => {
        nodeG.select("circle").attr("fill", (d) => nodeColor(d.id));

        pathSelection.each(function (d) {
          const elem = d3.select(this);
          elem
            .attr("stroke", "#64748b")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 2.5);

          // Force marker update by removing and re-adding
          elem.attr("marker-end", null).attr("marker-start", null);
          elem
            .attr("marker-end", "url(#arrowhead)")
            .attr("marker-start", d.bidirectional ? "url(#arrowhead)" : null);
        });
      });
  }, [edgeMap, dimentions]);

  return (
    <div
      className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100"
      ref={ref}
    >
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
