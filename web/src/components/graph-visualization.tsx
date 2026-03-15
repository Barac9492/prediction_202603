"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface GraphNode {
  id: string;
  label: string;
  type: "entity" | "thesis";
  category?: string;
  direction?: string;
  connectionCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const ENTITY_COLORS: Record<string, string> = {
  company: "#3B82F6",
  person: "#A855F7",
  technology: "#10B981",
  product: "#F97316",
  concept: "#EC4899",
  regulatory_body: "#EF4444",
  unknown: "#9CA3AF",
};

const THESIS_COLORS: Record<string, string> = {
  bullish: "#22C55E",
  bearish: "#EF4444",
  neutral: "#EAB308",
};

const EDGE_STYLES: Record<string, { dash: string; color: string }> = {
  SUPPORTS: { dash: "", color: "#22C55E" },
  CONTRADICTS: { dash: "6,3", color: "#EF4444" },
  MENTIONS: { dash: "2,2", color: "#D1D5DB" },
  RELATED_TO: { dash: "4,2", color: "#93C5FD" },
  RELEVANT_TO: { dash: "4,2", color: "#5EEAD4" },
  AFFECTS: { dash: "4,4", color: "#FBBF24" },
  DEPENDS_ON: { dash: "6,3", color: "#A78BFA" },
  COMPETES_WITH: { dash: "6,3", color: "#FB923C" },
  PRODUCES: { dash: "", color: "#818CF8" },
};

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimEdge = GraphEdge & { source: SimNode; target: SimNode };

export function GraphVisualization({ nodes, edges }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (container) {
      setDimensions({
        width: container.clientWidth,
        height: 500,
      });
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    // Create zoom container
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Build valid edges (only those with existing node IDs)
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter(
      (e) => nodeIds.has(e.source as unknown as string) && nodeIds.has(e.target as unknown as string)
    );

    // Create simulation
    const simulation = d3.forceSimulation<SimNode>(nodes as SimNode[])
      .force(
        "link",
        d3.forceLink<SimNode, SimEdge>(validEdges as unknown as SimEdge[])
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25));

    // Edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(validEdges)
      .join("line")
      .attr("stroke", (d) => EDGE_STYLES[d.relation]?.color ?? "#E5E7EB")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d) => EDGE_STYLES[d.relation]?.dash ?? "")
      .attr("opacity", 0.6);

    // Node groups
    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes as SimNode[])
      .join("g")
      .call(
        d3.drag<SVGGElement, SimNode>()
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
          })
      )
      .style("cursor", "pointer");

    // Entity nodes (circles)
    node
      .filter((d) => d.type === "entity")
      .append("circle")
      .attr("r", (d) => Math.min(6 + d.connectionCount * 1.5, 20))
      .attr("fill", (d) => ENTITY_COLORS[d.category ?? "unknown"] ?? ENTITY_COLORS.unknown)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Thesis nodes (rounded rectangles)
    node
      .filter((d) => d.type === "thesis")
      .append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("x", -8)
      .attr("y", -8)
      .attr("rx", 3)
      .attr("fill", (d) => THESIS_COLORS[d.direction ?? "neutral"] ?? THESIS_COLORS.neutral)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Labels
    node
      .append("text")
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + "..." : d.label)
      .attr("x", 0)
      .attr("y", (d) => (d.type === "thesis" ? -14 : -(Math.min(6 + d.connectionCount * 1.5, 20) + 4)))
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#374151")
      .attr("pointer-events", "none");

    // Click handler
    node.on("click", (_event, d) => {
      if (d.type === "entity") {
        const entityId = d.id.replace("entity-", "");
        window.location.href = `/entities/${entityId}`;
      } else {
        const thesisId = d.id.replace("thesis-", "");
        window.location.href = `/thesis/${thesisId}`;
      }
    });

    // Tooltip on hover
    node
      .append("title")
      .text((d) => `${d.label} (${d.type}${d.category ? ` - ${d.category}` : ""})`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as unknown as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as unknown as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as unknown as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as unknown as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-pm-border bg-white p-8 text-center text-pm-muted">
        <p>No graph data to visualize yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-pm-border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-pm-border bg-gray-50">
        <span className="text-xs font-medium text-pm-muted">
          {nodes.filter((n) => n.type === "entity").length} entities,{" "}
          {nodes.filter((n) => n.type === "thesis").length} theses,{" "}
          {edges.length} connections
        </span>
        <div className="flex gap-3 text-[10px] text-pm-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Entity
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-green-500" /> Thesis
          </span>
          <span>Scroll to zoom, drag to pan</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-white"
      />
    </div>
  );
}
