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
const NODE_SPACING = 150;
const TRANSITION_DURATION = 600;
const LAYER_STAGGER = 100;

function nodeColor(id: string) {
  switch (id) {
    case "start":
      return "#10b981";
    case "end":
      return "#ef4444";
    default:
      return "#a855f7";
  }
}

type PreviewProps = {
  onNodeClick: (nodeId: string) => void;
};
export default function Preview({ onNodeClick }: PreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dimentions = useDimenstions(ref);
  const edgeMap = useNodeNetworkStore((state) => state.edgeMap);
  const loading = useNodeNetworkStore((state) => state.loading);

  useEffect(() => {
    if (!edgeMap || !dimentions) return;
    const { width, height } = dimentions;

    // ===== BUILD LAYERS =====
    const layers: string[][] = [];
    const visited = new Set<string>();
    const nodeToLayer = new Map<string, number>();
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

    // Add disconnected nodes
    edgeMap.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        if (!layers[currentLayer]) layers[currentLayer] = [];
        layers[currentLayer].push(nodeId);
        nodeToLayer.set(nodeId, currentLayer);
      }
    });

    // ===== POSITION NODES =====
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

    // ===== BUILD EDGES =====
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

    let zoomGroup = svg.select<SVGGElement>("g.zoom-group");
    if (zoomGroup.empty()) {
      zoomGroup = svg.append("g").attr("class", "zoom-group");
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
      });

    svg.call(zoom);

    let defs = svg.select("defs");
    if (defs.empty()) {
      defs = svg.append("defs");
    }

    const patternId = "grid-pattern";
    let pattern = defs.select(`#${patternId}`);
    if (pattern.empty()) {
      pattern = defs
        .append("pattern")
        .attr("id", patternId)
        .attr("width", 20)
        .attr("height", 20)
        .attr("patternUnits", "userSpaceOnUse");

      pattern
        .append("circle")
        .attr("cx", 1)
        .attr("cy", 1)
        .attr("r", 1)
        .attr("fill", "#ccd0da");
    }

    let bgRect = zoomGroup.select("rect.grid-background");
    if (bgRect.empty()) {
      bgRect = zoomGroup
        .insert("rect", ":first-child")
        .attr("class", "grid-background")
        .attr("width", 10000)
        .attr("height", 10000)
        .attr("x", -5000)
        .attr("y", -5000)
        .attr("fill", `url(#${patternId})`);
    }

    // ===== LAYERS =====
    let edgeLayer = zoomGroup.select("g.edge-layer");
    if (edgeLayer.empty()) {
      edgeLayer = zoomGroup.append("g").attr("class", "edge-layer");
    }

    let nodeLayer = zoomGroup.select("g.node-layer");
    if (nodeLayer.empty()) {
      nodeLayer = zoomGroup.append("g").attr("class", "node-layer");
    }

    // ===== PATH GENERATOR =====
    const generatePath = (d: (typeof edges)[0]) => {
      const { source, target } = d;

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
        return `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;
      }

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offsetX = (dx / dist) * RADIUS;
      const offsetY = (dy / dist) * RADIUS;
      const sx = source.x + offsetX;
      const sy = source.y + offsetY;
      const tx = target.x - offsetX;
      const ty = target.y - offsetY;
      const curvature = 0.3;
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const perpX = -(ty - sy) * curvature;
      const perpY = (tx - sx) * curvature;
      const cx = midX + perpX;
      const cy = midY + perpY;

      return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
    };

    // Compute arrow position for end or start
    const getArrowPosition = (d: (typeof edges)[0], atEnd = true) => {
      // create a temporary path element (SVG) to measure length/points
      const tempPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      ) as SVGPathElement;
      tempPath.setAttribute("d", generatePath(d));
      // get total length and sample points
      const length = tempPath.getTotalLength();
      // small offsets to compute direction
      if (atEnd) {
        const p = tempPath.getPointAtLength(Math.max(0, length - 1));
        const prev = tempPath.getPointAtLength(Math.max(0, length - 6));
        const angle = Math.atan2(p.y - prev.y, p.x - prev.x) * (180 / Math.PI);
        return { x: p.x, y: p.y, angle };
      } else {
        const p = tempPath.getPointAtLength(Math.min(1, length));
        const next = tempPath.getPointAtLength(Math.min(6, length));
        // direction from p -> next; for start arrow we want it pointing backward, so add 180
        const angle =
          Math.atan2(next.y - p.y, next.x - p.x) * (180 / Math.PI) + 180;
        return { x: p.x, y: p.y, angle };
      }
    };

    // ===== UPDATE EDGES =====
    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, (typeof edges)[0]>("g.edge")
      .data(edges, (d) => `${d.source.id}-${d.target.id}`)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "edge");

          // path
          g.append("path")
            .attr("fill", "none")
            .attr("stroke", "#64748b")
            .attr("stroke-width", 2.5)
            .attr("stroke-opacity", 0)
            .attr("d", generatePath);

          // end arrow
          g.append("polygon")
            .attr("class", "arrow-end")
            .attr("points", "0,0 -8,4 -8,-4")
            .attr("fill", "#64748b")
            .attr("opacity", 0)
            .attr("transform", (d) => {
              const { x, y, angle } = getArrowPosition(d, true);
              return `translate(${x},${y}) rotate(${angle})`;
            });

          // start arrow (only if bidirectional) - create but keep opacity 0 when not used
          g.append("polygon")
            .attr("class", "arrow-start")
            .attr("points", "0,0 -8,4 -8,-4")
            .attr("fill", "#64748b")
            .attr("opacity", 0)
            .attr("transform", (d) => {
              const { x, y, angle } = getArrowPosition(d, false);
              return `translate(${x},${y}) rotate(${angle})`;
            });

          return g.call((g) =>
            g
              .transition()
              .duration(TRANSITION_DURATION)
              .delay(
                (d) =>
                  Math.max(d.source.layer, d.target.layer) * LAYER_STAGGER +
                  200,
              )
              .ease(d3.easeCubicOut)
              .call((t) => {
                t.select("path").attr("stroke-opacity", 0.6);
                t.select("polygon.arrow-end").attr("opacity", 1);
                // show start arrow only for bidirectional edges
                t.select("polygon.arrow-start").attr("opacity", (d) =>
                  d.bidirectional ? 1 : 0,
                );
              }),
          );
        },
        (update) =>
          update.call((g) =>
            g
              .transition()
              .duration(TRANSITION_DURATION)
              .ease(d3.easeCubicOut)
              .call((t) => {
                t.select("path").attr("d", generatePath);
                t.select("polygon.arrow-end").attr("transform", (d) => {
                  const { x, y, angle } = getArrowPosition(d, true);
                  return `translate(${x},${y}) rotate(${angle})`;
                });
                t.select("polygon.arrow-start")
                  .attr("transform", (d) => {
                    const { x, y, angle } = getArrowPosition(d, false);
                    return `translate(${x},${y}) rotate(${angle})`;
                  })
                  .attr("opacity", (d) => (d.bidirectional ? 1 : 0));
              }),
          ),
        (exit) =>
          exit.call((g) =>
            g
              .transition()
              .duration(TRANSITION_DURATION / 2)
              .ease(d3.easeCubicIn)
              .call((t) => {
                t.select("path").attr("stroke-opacity", 0);
                t.selectAll("polygon").attr("opacity", 0);
              })
              .remove(),
          ),
      );

    // ===== UPDATE NODES =====
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
            .attr("stroke-width", 2)
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
              .call((t) => {
                t.select("circle").attr("r", RADIUS).attr("opacity", 1);
                t.select("text").attr("opacity", 1);
              }),
          );
        },
        (update) =>
          update.call((u) =>
            u
              .transition()
              .duration(TRANSITION_DURATION)
              .ease(d3.easeCubicOut)
              .attr("transform", (d) => `translate(${d.x},${d.y})`),
          ),
        (exit) =>
          exit.call((e) =>
            e
              .transition()
              .duration(TRANSITION_DURATION / 2)
              .ease(d3.easeBackIn.overshoot(1.2))
              .call((t) => {
                t.select("circle").attr("r", 0).attr("opacity", 0);
                t.select("text").attr("opacity", 0);
              })
              .remove(),
          ),
      );

    nodeG.on("click", (event, d) => {
      event.stopPropagation();
      if (onNodeClick) onNodeClick(d.id);
    });

    // ===== HOVER EFFECTS =====
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

        edgeGroups.each(function (e) {
          const isConnected =
            e.source.id === hoveredNode.id || e.target.id === hoveredNode.id;
          const g = d3.select(this);

          g.select("path")
            .attr("stroke", isConnected ? "#ec4899" : "#cbd5e1")
            .attr("stroke-opacity", isConnected ? 1 : 0.2)
            .attr("stroke-width", isConnected ? 3 : 2.5);

          // apply fill to all arrow polygons (end + start)
          g.selectAll("polygon").attr(
            "fill",
            isConnected ? "#ec4899" : "#cbd5e1",
          );
        });
      })
      .on("mouseleave", () => {
        nodeG.select("circle").attr("fill", (d) => nodeColor(d.id));

        edgeGroups.each(function () {
          const g = d3.select(this);
          g.select("path")
            .attr("stroke", "#64748b")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 2.5);

          g.selectAll("polygon").attr("fill", "#64748b");
        });
      });
  }, [edgeMap, dimentions]);

  return (
    <div
      className="h-full w-full bg-gradient-to-b from-slate-50 to-slate-100"
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
