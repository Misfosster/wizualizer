import { expect, test } from "@playwright/test";
import { buildGraph, getActionNodeKind } from "../../src/utils/apl-parser/build-graph";
import { parseDocument, type AplDocument } from "../../src/utils/apl-parser/document";

const STRUCTURAL_APL = [
  'shaman="Demo Profile"',
  "actions.precombat=windfury_weapon",
  "actions+=/variable,name=aoe_threshold,op=set,value=active_enemies,if=active_enemies>1",
  "actions+=/call_action_list,name=cds",
  "actions+=/use_item,name=treacherous_transmitter,if=fight_remains<=20",
  "actions+=/sequence,stormstrike:lavalash:crashlightning",
].join("\n");

const FALLBACK_APL = [
  'shaman="Fallback Demo"',
  "actions+=/variable,if=active_enemies>1",
  "actions+=/use_items,slots=trinket1,if=fight_remains<=20",
  "actions+=/call_action_list",
].join("\n");

function buildGraphFromText(
  text: string,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
) {
  const parsed = parseDocument(text);
  if (!parsed.ok) {
    throw new Error(
      `Parse failed on line ${String(parsed.lineNumber)}: ${parsed.error}\n${parsed.lineText}`,
    );
  }

  return buildGraph(parsed.document, collapsedBlocks);
}

function getNode<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  expect(item, `Expected item ${id} to exist`).toBeTruthy();

  if (!item) {
    throw new Error(`Missing item: ${id}`);
  }

  return item;
}

test("getActionNodeKind maps structural spells to custom node kinds", () => {
  expect(getActionNodeKind("variable")).toBe("variable");
  expect(getActionNodeKind("cycling_variable")).toBe("variable");
  expect(getActionNodeKind("use_item")).toBe("useItem");
  expect(getActionNodeKind("use_items")).toBe("useItem");
  expect(getActionNodeKind("call_action_list")).toBe("callActionList");
  expect(getActionNodeKind("run_action_list")).toBe("callActionList");
  expect(getActionNodeKind("sequence")).toBe("sequence");
  expect(getActionNodeKind("strict_sequence")).toBe("sequence");
  expect(getActionNodeKind("auto_attack")).toBe("action");
});

test("buildGraph emits typed structural node data and variable handles", () => {
  const graph = buildGraphFromText(STRUCTURAL_APL);

  const rootNode = getNode(graph.nodes, "root__0");
  expect(rootNode.type).toBe("root");
  expect(rootNode.data).toMatchObject({
    kind: "root",
    label: "Demo Profile",
    blockCount: 2,
    actionCount: 5,
  });

  const blockNode = getNode(graph.nodes, "block__0__actions");
  expect(blockNode.type).toBe("block");
  expect(blockNode.data).toMatchObject({
    kind: "block",
    label: "actions",
    actionCount: 4,
    isCollapsed: false,
  });

  const variableNode = getNode(graph.nodes, "action__0__actions__0");
  expect(variableNode.type).toBe("variable");
  if (variableNode.type !== "variable") {
    throw new Error("Expected variable node");
  }
  expect(variableNode.data).toMatchObject({
    kind: "variable",
    label: "variable",
    variableName: "aoe_threshold",
    op: "set",
    valueText: "active_enemies",
  });

  const valueNode = getNode(
    graph.nodes,
    "valueExpression__0__actions__0__value",
  );
  expect(valueNode.type).toBe("valueExpression");
  expect(valueNode.data).toMatchObject({
    kind: "valueExpression",
    label: "active_enemies",
  });

  const valueEdge = getNode(graph.edges, "edge__action__0__actions__0__value");
  expect(valueEdge.source).toBe("action__0__actions__0");
  expect(valueEdge.target).toBe("valueExpression__0__actions__0__value");
  expect(valueEdge.sourceHandle).toBe("val");
  expect(valueEdge.style).toMatchObject({ stroke: "#8b5cf6" });

  const variableConditionEdge = getNode(
    graph.edges,
    "edge__action__0__actions__0__if",
  );
  expect(variableConditionEdge.sourceHandle).toBe("if");

  const callNode = getNode(graph.nodes, "action__0__actions__1");
  expect(callNode.type).toBe("callActionList");
  if (callNode.type !== "callActionList") {
    throw new Error("Expected callActionList node");
  }
  expect(callNode.data).toMatchObject({
    kind: "callActionList",
    label: "call_action_list",
    targetList: "cds",
  });

  const useItemNode = getNode(graph.nodes, "action__0__actions__2");
  expect(useItemNode.type).toBe("useItem");
  if (useItemNode.type !== "useItem") {
    throw new Error("Expected useItem node");
  }
  expect(useItemNode.data).toMatchObject({
    kind: "useItem",
    label: "use_item",
    itemName: "treacherous_transmitter",
    hasCondition: true,
  });

  const sequenceNode = getNode(graph.nodes, "action__0__actions__3");
  expect(sequenceNode.type).toBe("sequence");
  if (sequenceNode.type !== "sequence") {
    throw new Error("Expected sequence node");
  }
  expect(sequenceNode.data).toMatchObject({
    kind: "sequence",
    label: "sequence",
    spells: ["stormstrike", "lavalash", "crashlightning"],
  });
});

test("buildGraph keeps sequence conditions when the parsed document includes them", () => {
  const document: AplDocument = {
    profiles: [
      {
        name: "Manual Sequence Demo",
        className: "shaman",
        blocks: [
          {
            name: "actions",
            actions: [
              {
                rawLine:
                  "actions+=/sequence,stormstrike:lavalash:crashlightning,if=active_enemies>2",
                lineNumber: 1,
                action: {
                  category: "actions",
                  spell: "sequence",
                  op: "+=",
                  segments: [
                    {
                      type: "sequence",
                      expr: {
                        kind: "sequence",
                        expr: [
                          { kind: "ident", name: "stormstrike" },
                          { kind: "ident", name: "lavalash" },
                          { kind: "ident", name: "crashlightning" },
                        ],
                      },
                    },
                    {
                      type: "if",
                      expr: {
                        kind: "binary",
                        op: ">",
                        left: { kind: "ident", name: "active_enemies" },
                        right: { kind: "number", value: 2 },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  const graph = buildGraph(document);
  const sequenceNode = getNode(graph.nodes, "action__0__actions__0");
  expect(sequenceNode.type).toBe("sequence");

  const conditionNode = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(conditionNode.type).toBe("condition");
  expect(conditionNode.data).toMatchObject({
    kind: "condition",
    label: "active_enemies>2",
  });
});

test("buildGraph hides block children when a block is collapsed", () => {
  const graph = buildGraphFromText(
    STRUCTURAL_APL,
    new Set<string>(["block__0__actions"]),
  );

  const collapsedBlockNode = getNode(graph.nodes, "block__0__actions");
  expect(collapsedBlockNode.type).toBe("block");
  expect(collapsedBlockNode.data).toMatchObject({
    kind: "block",
    label: "actions",
    isCollapsed: true,
  });

  expect(
    graph.nodes.find((node) => node.id === "action__0__actions__0"),
  ).toBeUndefined();
  expect(
    graph.edges.find((edge) => edge.id === "edge__block__0__actions__0"),
  ).toBeUndefined();

  expect(
    graph.nodes.find((node) => node.id === "action__0__actions.precombat__0"),
  ).toBeTruthy();
});

test("buildGraph falls back gracefully when structural metadata is missing", () => {
  const graph = buildGraphFromText(FALLBACK_APL);

  const variableNode = getNode(graph.nodes, "action__0__actions__0");
  expect(variableNode.type).toBe("variable");
  if (variableNode.type !== "variable") {
    throw new Error("Expected variable node");
  }
  expect(variableNode.data).toMatchObject({
    variableName: "(unnamed)",
    op: "set",
    valueText: "(no value)",
  });

  const valueNode = getNode(
    graph.nodes,
    "valueExpression__0__actions__0__value",
  );
  expect(valueNode.type).toBe("valueExpression");
  expect(valueNode.data).toMatchObject({ label: "(no value)" });

  const useItemNode = getNode(graph.nodes, "action__0__actions__1");
  expect(useItemNode.type).toBe("useItem");
  if (useItemNode.type !== "useItem") {
    throw new Error("Expected useItem node");
  }
  expect(useItemNode.data).toMatchObject({
    label: "use_items",
    itemName: "trinket1",
    hasCondition: true,
  });

  const callNode = getNode(graph.nodes, "action__0__actions__2");
  expect(callNode.type).toBe("callActionList");
  if (callNode.type !== "callActionList") {
    throw new Error("Expected callActionList node");
  }
  expect(callNode.data).toMatchObject({ targetList: "(unnamed list)" });
});
