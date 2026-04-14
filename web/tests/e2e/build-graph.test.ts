import { expect, test } from "@playwright/test";
import { CONDITION_HANDLE_IDS } from "../../src/components/nodes/types";
import {
  buildGraph,
  getActionNodeKind,
} from "../../src/utils/apl-parser/build-graph";
import { parseDocument, type AplDocument } from "../../src/utils/apl-parser/document";
import {
  gridPoint,
  LANE_WIDTH,
  ROW_HEIGHT,
} from "../../src/utils/apl-parser/grid-layout";

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

const expressionLaneX = gridPoint("expression", 0).x;

function buildGraphFromText(
  text: string,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
  collapsedActions: ReadonlySet<string> = new Set<string>(),
) {
  const parsed = parseDocument(text);
  if (!parsed.ok) {
    throw new Error(
      `Parse failed on line ${String(parsed.lineNumber)}: ${parsed.error}\n${parsed.lineText}`,
    );
  }

  return buildGraph(parsed.document, collapsedBlocks, collapsedActions);
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
    hasExplicitOp: true,
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
  expect(valueEdge.targetHandle).toBe(CONDITION_HANDLE_IDS.targetLeft);
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

test("variable value OR expressions expand into value expression nodes", () => {
  const graph = buildGraphFromText([
    'shaman="Variable Value Demo"',
    "actions.precombat+=/variable,name=trinket2_is_weird,value=trinket.2.is.algethar_puzzle_box|trinket.2.is.unyielding_netherprism",
  ].join("\n"));

  const variableNode = getNode(
    graph.nodes,
    "action__0__actions.precombat__0",
  );
  expect(variableNode.type).toBe("variable");
  expect(variableNode.data).toMatchObject({
    variableName: "trinket2_is_weird",
    hasExplicitOp: false,
    valueText:
      "trinket.2.is.algethar_puzzle_box|trinket.2.is.unyielding_netherprism",
  });

  expect(
    graph.nodes.find(
      (node) => node.id === "valueExpression__0__actions.precombat__0__value",
    ),
  ).toBeUndefined();

  const firstValue = getNode(
    graph.nodes,
    "valueExpression__0__actions.precombat__0__value__0",
  );
  expect(firstValue.type).toBe("valueExpression");
  expect(firstValue.data).toMatchObject({
    label: "trinket.2.is.algethar_puzzle_box",
    handleUsage: {
      targetLeft: true,
      sourceBottom: true,
    },
  });

  const secondValue = getNode(
    graph.nodes,
    "valueExpression__0__actions.precombat__0__value__1",
  );
  expect(secondValue.type).toBe("valueExpression");
  expect(secondValue.data).toMatchObject({
    label: "trinket.2.is.unyielding_netherprism",
    handleUsage: {
      targetTop: true,
    },
  });

  const valueEdge = getNode(
    graph.edges,
    "edge__action__0__actions.precombat__0__value",
  );
  expect(valueEdge).toMatchObject({
    source: "action__0__actions.precombat__0",
    target: "valueExpression__0__actions.precombat__0__value__0",
    sourceHandle: "val",
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
  });

  const orEdge = getNode(
    graph.edges,
    "edge__valueExpression__0__actions.precombat__0__value__or__1",
  );
  expect(orEdge).toMatchObject({
    label: "OR",
    source: "valueExpression__0__actions.precombat__0__value__0",
    target: "valueExpression__0__actions.precombat__0__value__1",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
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
    hasExplicitOp: false,
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

test("buildGraph places nodes at deterministic grid positions", () => {
  const graph = buildGraphFromText(STRUCTURAL_APL);

  const lane = (index: number) => index * LANE_WIDTH;
  const row = (index: number) => index * ROW_HEIGHT;

  expect(getNode(graph.nodes, "root__0").position).toEqual({ x: lane(0), y: row(0) });

  expect(getNode(graph.nodes, "block__0__actions.precombat").position).toEqual({
    x: lane(1), y: row(0),
  });
  expect(getNode(graph.nodes, "action__0__actions.precombat__0").position).toEqual({
    x: lane(2), y: row(1),
  });

  expect(getNode(graph.nodes, "block__0__actions").position).toEqual({
    x: lane(1), y: row(2),
  });

  expect(getNode(graph.nodes, "action__0__actions__0").position).toEqual({
    x: lane(2), y: row(3),
  });
  expect(getNode(graph.nodes, "valueExpression__0__actions__0__value").position).toEqual({
    x: expressionLaneX, y: row(3),
  });
  expect(getNode(graph.nodes, "condition__0__actions__0__if").position).toEqual({
    x: expressionLaneX, y: row(4),
  });

  expect(getNode(graph.nodes, "action__0__actions__1").position).toEqual({
    x: lane(2), y: row(5.5),
  });
  expect(getNode(graph.nodes, "action__0__actions__2").position).toEqual({
    x: lane(2), y: row(7) - 14,
  });
  expect(getNode(graph.nodes, "condition__0__actions__2__if").position).toEqual({
    x: expressionLaneX, y: row(7),
  });
  expect(getNode(graph.nodes, "action__0__actions__3").position).toEqual({
    x: lane(2), y: row(8.5),
  });
});

test("collapsed block occupies one row and shifts following blocks upward", () => {
  const graph = buildGraphFromText(
    STRUCTURAL_APL,
    new Set<string>(["block__0__actions"]),
  );

  const lane = (index: number) => index * LANE_WIDTH;
  const row = (index: number) => index * ROW_HEIGHT;

  const collapsedBlock = getNode(graph.nodes, "block__0__actions");
  expect(collapsedBlock.position).toEqual({ x: lane(1), y: row(2) });
  expect(collapsedBlock.data).toMatchObject({ isCollapsed: true });

  expect(graph.nodes.find((n) => n.id === "action__0__actions__0")).toBeUndefined();
  expect(graph.nodes.find((n) => n.id === "action__0__actions__1")).toBeUndefined();

  expect(getNode(graph.nodes, "block__0__actions.precombat").position).toEqual({
    x: lane(1), y: row(0),
  });
});

test("collapsed action hides only that action detail graph", () => {
  const graph = buildGraphFromText(
    STRUCTURAL_APL,
    new Set<string>(),
    new Set<string>(["action__0__actions__0"]),
  );

  const lane = (index: number) => index * LANE_WIDTH;
  const row = (index: number) => index * ROW_HEIGHT;

  const collapsedAction = getNode(graph.nodes, "action__0__actions__0");
  expect(collapsedAction.type).toBe("variable");
  expect(collapsedAction.data).toMatchObject({
    isCollapsed: true,
    hasChildren: true,
  });

  expect(
    graph.nodes.find(
      (node) => node.id === "valueExpression__0__actions__0__value",
    ),
  ).toBeUndefined();
  expect(
    graph.nodes.find((node) => node.id === "condition__0__actions__0__if"),
  ).toBeUndefined();
  expect(
    graph.edges.find((edge) => edge.id === "edge__action__0__actions__0__value"),
  ).toBeUndefined();
  expect(
    graph.edges.find((edge) => edge.id === "edge__action__0__actions__0__if"),
  ).toBeUndefined();

  expect(getNode(graph.nodes, "action__0__actions__1").position).toEqual({
    x: lane(2),
    y: row(4.5),
  });
  expect(getNode(graph.nodes, "action__0__actions__2").position).toEqual({
    x: lane(2),
    y: row(6) - 14,
  });
  expect(getNode(graph.nodes, "condition__0__actions__2__if").position).toEqual({
    x: expressionLaneX,
    y: row(6),
  });
});

test("bare OR chain produces leaf nodes with OR edges, no container", () => {
  const document: AplDocument = {
    profiles: [
      {
        name: "Chain Demo",
        className: "shaman",
        blocks: [
          {
            name: "actions",
            actions: [
              {
                rawLine:
                  "actions+=/sundering,if=talent.surging_elements.enabled|buff.whirling_earth.up|talent.feral_spirit.enabled",
                lineNumber: 1,
                action: {
                  category: "actions",
                  spell: "sundering",
                  op: "+=",
                  segments: [
                    {
                      type: "if",
                      expr: {
                        kind: "binary",
                        op: "|",
                        left: {
                          kind: "binary",
                          op: "|",
                          left: { kind: "ident", name: "talent.surging_elements.enabled" },
                          right: { kind: "ident", name: "buff.whirling_earth.up" },
                        },
                        right: { kind: "ident", name: "talent.feral_spirit.enabled" },
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

  const row = (index: number) => index * ROW_HEIGHT;

  const cond0 = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(cond0.type).toBe("condition");
  expect(cond0.data).toMatchObject({ label: "talent.surging_elements.enabled" });
  expect(cond0.position).toEqual({ x: expressionLaneX, y: row(1) });
  expect(cond0.data).toMatchObject({
    handleUsage: {
      targetLeft: true,
      sourceBottom: true,
    },
  });
  expect(cond0.data).not.toMatchObject({
    handleUsage: {
      sourceRight: true,
      targetTop: true,
    },
  });

  const cond1 = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(cond1.data).toMatchObject({ label: "buff.whirling_earth.up" });
  expect(cond1.position).toEqual({
    x: expressionLaneX + 26,
    y: row(1) + 114,
  });

  const cond2 = getNode(graph.nodes, "condition__0__actions__0__if__2");
  expect(cond2.data).toMatchObject({ label: "talent.feral_spirit.enabled" });
  expect(cond2.position).toEqual({
    x: expressionLaneX + 15,
    y: row(1) + 228,
  });

  expect(graph.nodes.find((n) => n.type === "container")).toBeUndefined();

  const actionToFirst = getNode(graph.edges, "edge__action__0__actions__0__if");
  expect(actionToFirst.target).toBe("condition__0__actions__0__if__0");
  expect(actionToFirst.targetHandle).toBe(CONDITION_HANDLE_IDS.targetLeft);

  const orEdge1 = getNode(graph.edges, "edge__condition__0__actions__0__if__or__1");
  expect(orEdge1).toMatchObject({
    label: "OR",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
    style: { stroke: "rgba(122, 167, 255, 0.62)" },
    labelStyle: { fill: "rgba(232, 240, 255, 0.68)" },
  });

  const orEdge2 = getNode(graph.edges, "edge__condition__0__actions__0__if__or__2");
  expect(orEdge2).toMatchObject({
    label: "OR",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
  });
});

test("redundant parentheses around an OR chain do not produce a group container", () => {
  const graph = buildGraphFromText([
    'shaman="Redundant Paren Demo"',
    "actions+=/stormstrike,if=((A|B))",
  ].join("\n"));

  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(0);

  const condA = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(condA.type).toBe("condition");
  expect(condA.data).toMatchObject({ label: "A" });
  expect(condA.data).toMatchObject({
    handleUsage: {
      targetLeft: true,
      sourceBottom: true,
    },
  });

  const condB = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(condB.type).toBe("condition");
  expect(condB.data).toMatchObject({ label: "B" });
  expect(condB.data).toMatchObject({
    handleUsage: {
      targetTop: true,
    },
  });

  const orEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__or__1");
  expect(orEdge).toMatchObject({
    source: "condition__0__actions__0__if__0",
    target: "condition__0__actions__0__if__1",
    label: "OR",
  });
});

test("pure AND chain produces horizontal condition nodes without a container", () => {
  const graph = buildGraphFromText([
    'shaman="AND Demo"',
    "actions+=/stormstrike,if=buff.hot_hand.up&cooldown.lava_lash.remains>1",
  ].join("\n"));

  const row = (index: number) => index * ROW_HEIGHT;

  expect(graph.nodes.find((n) => n.type === "container")).toBeUndefined();

  const cond0 = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(cond0.type).toBe("condition");
  expect(cond0.data).toMatchObject({ label: "buff.hot_hand.up" });
  expect(cond0.parentId).toBeUndefined();
  expect(cond0.position).toEqual({ x: expressionLaneX, y: row(1) });
  expect(cond0.data).toMatchObject({
    handleUsage: {
      targetLeft: true,
      sourceRight: true,
    },
  });
  expect(cond0.data).not.toMatchObject({
    handleUsage: {
      targetTop: true,
      sourceBottom: true,
    },
  });

  const cond1 = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(cond1.type).toBe("condition");
  expect(cond1.data).toMatchObject({ label: "cooldown.lava_lash.remains>1" });
  expect(cond1.parentId).toBeUndefined();
  expect(cond1.position).toEqual({ x: expressionLaneX + 316, y: row(1) });
  expect(cond1.data).toMatchObject({
    handleUsage: {
      targetLeft: true,
    },
  });
  expect(cond1.data).not.toMatchObject({
    handleUsage: {
      sourceRight: true,
      targetTop: true,
      sourceBottom: true,
    },
  });

  const actionToFirst = getNode(graph.edges, "edge__action__0__actions__0__if");
  expect(actionToFirst.target).toBe("condition__0__actions__0__if__0");
  expect(actionToFirst.targetHandle).toBe(CONDITION_HANDLE_IDS.targetLeft);

  const andEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__and__1");
  expect(andEdge).toMatchObject({
    label: "AND",
    sourceHandle: CONDITION_HANDLE_IDS.sourceRight,
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
    type: "straight",
    style: { stroke: "#6fc2c9" },
    labelStyle: { fill: "rgba(223, 247, 248, 0.78)" },
  });
});

test("long condition labels widen their condition node", () => {
  const graph = buildGraphFromText([
    'shaman="Long Condition Demo"',
    "actions+=/stormstrike,if=very.long.condition.identifier.with.extra.parts.and_suffix.enabled",
  ].join("\n"));

  const condition = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(condition.type).toBe("condition");
  expect(condition.style).toMatchObject({ width: expect.any(Number) });
  expect(Number(condition.style?.width)).toBeGreaterThan(280);
});

test("AND branch contested by OR gets an AND container", () => {
  const graph = buildGraphFromText([
    'shaman="Contested AND Demo"',
    "actions+=/stormstrike,if=(A&B|C)",
  ].join("\n"));

  const lane = (index: number) => index * LANE_WIDTH;
  const row = (index: number) => index * ROW_HEIGHT;

  const andContainer = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(andContainer.type).toBe("container");
  expect(andContainer.data).toMatchObject({ kind: "container", operator: "and" });
  expect(andContainer.position).toEqual({ x: expressionLaneX, y: row(1) });
  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(1);

  const action = getNode(graph.nodes, "action__0__actions__0");
  expect(action.position).toEqual({ x: lane(2), y: row(1) + 20 });

  const innerA = getNode(graph.nodes, "condition__0__actions__0__if__0__0");
  expect(innerA.type).toBe("condition");
  expect(innerA.data).toMatchObject({ label: "A" });
  expect(innerA.parentId).toBe("condition__0__actions__0__if__0");
  expect(innerA.position).toEqual({ x: 20, y: 20 });

  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__0__1");
  expect(innerB.type).toBe("condition");
  expect(innerB.data).toMatchObject({ label: "B" });
  expect(innerB.parentId).toBe("condition__0__actions__0__if__0");
  expect(innerB.position).toEqual({ x: 336, y: 20 });

  const standaloneC = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(standaloneC.type).toBe("condition");
  expect(standaloneC.data).toMatchObject({ label: "C" });
  expect(standaloneC.position).toEqual({
    x: expressionLaneX + 178,
    y: row(1) + 154,
  });

  const andEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__0__and__1");
  expect(andEdge).toMatchObject({
    label: "AND",
    sourceHandle: CONDITION_HANDLE_IDS.sourceRight,
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
    type: "straight",
  });

  const orEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__or__1");
  expect(orEdge).toMatchObject({
    label: "OR",
    source: "condition__0__actions__0__if__0",
    target: "condition__0__actions__0__if__1",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
    type: "straight",
  });

  const actionToContainer = getNode(graph.edges, "edge__action__0__actions__0__if");
  expect(actionToContainer).toMatchObject({
    target: "condition__0__actions__0__if__0",
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
  });
});

test("parenthesized AND branch under OR elides the group container", () => {
  const graph = buildGraphFromText([
    'shaman="Parenthesized AND Demo"',
    "actions+=/stormstrike,if=A|(B&C)",
  ].join("\n"));

  const andContainer = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(andContainer.type).toBe("container");
  expect(andContainer.data).toMatchObject({ kind: "container", operator: "and" });
  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(1);

  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__1__0");
  expect(innerB.type).toBe("condition");
  expect(innerB.data).toMatchObject({ label: "B" });
  expect(innerB.parentId).toBe("condition__0__actions__0__if__1");

  const innerC = getNode(graph.nodes, "condition__0__actions__0__if__1__1");
  expect(innerC.type).toBe("condition");
  expect(innerC.data).toMatchObject({ label: "C" });
  expect(innerC.parentId).toBe("condition__0__actions__0__if__1");
});

test("parenthesized OR in AND chain produces container for the grouped part", () => {
  const document: AplDocument = {
    profiles: [
      {
        name: "Paren Demo",
        className: "shaman",
        blocks: [
          {
            name: "actions",
            actions: [
              {
                rawLine: "actions+=/sundering,if=(A|B)&C",
                lineNumber: 1,
                action: {
                  category: "actions",
                  spell: "sundering",
                  op: "+=",
                  segments: [
                    {
                      type: "if",
                      expr: {
                        kind: "binary",
                        op: "&",
                        left: {
                          kind: "paren",
                          expr: {
                            kind: "binary",
                            op: "|",
                            left: { kind: "ident", name: "A" },
                            right: { kind: "ident", name: "B" },
                          },
                        },
                        right: { kind: "ident", name: "C" },
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

  const containerNode = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(containerNode.type).toBe("container");
  expect(containerNode.data).toMatchObject({ kind: "container", depth: 0 });
  expect(containerNode.parentId).toBeUndefined();

  const innerA = getNode(graph.nodes, "condition__0__actions__0__if__0__inner__0");
  expect(innerA.type).toBe("condition");
  expect(innerA.data).toMatchObject({ label: "A" });
  expect(innerA.parentId).toBe("condition__0__actions__0__if__0");

  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__0__inner__1");
  expect(innerB.type).toBe("condition");
  expect(innerB.data).toMatchObject({ label: "B" });
  expect(innerB.parentId).toBe("condition__0__actions__0__if__0");

  const standaloneC = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(standaloneC.type).toBe("condition");
  expect(standaloneC.data).toMatchObject({ label: "C" });
  expect(standaloneC.parentId).toBeUndefined();

  const orEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__0__inner__or__1");
  expect(orEdge).toMatchObject({
    label: "OR",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
    type: "straight",
  });

  const andEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__and__1");
  expect(andEdge).toMatchObject({
    label: "AND",
    sourceHandle: CONDITION_HANDLE_IDS.sourceRight,
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
    type: "straight",
  });
});

test("AND with parenthesized OR on the right: A&(B|C)", () => {
  const document: AplDocument = {
    profiles: [
      {
        name: "Right Paren Demo",
        className: "shaman",
        blocks: [
          {
            name: "actions",
            actions: [
              {
                rawLine: "actions+=/sundering,if=A&(B|C)",
                lineNumber: 1,
                action: {
                  category: "actions",
                  spell: "sundering",
                  op: "+=",
                  segments: [
                    {
                      type: "if",
                      expr: {
                        kind: "binary",
                        op: "&",
                        left: { kind: "ident", name: "A" },
                        right: {
                          kind: "paren",
                          expr: {
                            kind: "binary",
                            op: "|",
                            left: { kind: "ident", name: "B" },
                            right: { kind: "ident", name: "C" },
                          },
                        },
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

  const standaloneA = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(standaloneA.type).toBe("condition");
  expect(standaloneA.data).toMatchObject({ label: "A" });
  expect(standaloneA.parentId).toBeUndefined();

  const containerNode = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(containerNode.type).toBe("container");
  expect(containerNode.data).toMatchObject({ kind: "container", depth: 0 });
  expect(containerNode.parentId).toBeUndefined();

  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__1__inner__0");
  expect(innerB.type).toBe("condition");
  expect(innerB.data).toMatchObject({ label: "B" });
  expect(innerB.parentId).toBe("condition__0__actions__0__if__1");

  const innerC = getNode(graph.nodes, "condition__0__actions__0__if__1__inner__1");
  expect(innerC.type).toBe("condition");
  expect(innerC.data).toMatchObject({ label: "C" });
  expect(innerC.parentId).toBe("condition__0__actions__0__if__1");

  const andEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__and__1");
  expect(andEdge).toMatchObject({
    label: "AND",
    sourceHandle: CONDITION_HANDLE_IDS.sourceRight,
    targetHandle: CONDITION_HANDLE_IDS.targetLeft,
    type: "straight",
  });

  const orEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__1__inner__or__1");
  expect(orEdge).toMatchObject({
    label: "OR",
    sourceHandle: CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle: CONDITION_HANDLE_IDS.targetTop,
    type: "straight",
  });
});

test("buildGraph keeps simple comparison conditions as single nodes", () => {
  const graph = buildGraphFromText(STRUCTURAL_APL);

  const cond = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(cond.type).toBe("condition");
  expect(cond.data).toMatchObject({ label: "active_enemies>1" });

  expect(graph.nodes.find((n) => n.id === "condition__0__actions__0__if__0")).toBeUndefined();
});

test("comparison with arithmetic on the right stays an atomic condition node", () => {
  const expression =
    "cooldown.lava_lash.remains < gcd.max + buff.maelstrom_weapon.stack * 0.3";
  const graph = buildGraphFromText([
    'shaman="Arithmetic RHS Demo"',
    `actions+=/stormstrike,if=${expression}`,
  ].join("\n"));

  const condition = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(condition.type).toBe("condition");
  expect(condition.data).toMatchObject({
    label: expression,
    expressionKind: "comparison",
  });

  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(0);
  expect(
    graph.nodes.find((node) => node.id === "condition__0__actions__0__if__0"),
  ).toBeUndefined();
});

test("comparison with arithmetic on the left stays an atomic condition node", () => {
  const expression =
    "buff.maelstrom_weapon.stack*0.3+gcd.max<cooldown.lava_lash.remains";
  const graph = buildGraphFromText([
    'shaman="Arithmetic LHS Demo"',
    `actions+=/stormstrike,if=${expression}`,
  ].join("\n"));

  const condition = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(condition.type).toBe("condition");
  expect(condition.data).toMatchObject({
    label: expression,
    expressionKind: "comparison",
  });

  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(0);
  expect(
    graph.nodes.find((node) => node.id === "condition__0__actions__0__if__0"),
  ).toBeUndefined();
});

test("parenthesized arithmetic-only comparison does not create a default group container", () => {
  const expression = "cooldown.lava_lash.remains<gcd.max+(foo.bar*0.3)";
  const graph = buildGraphFromText([
    'shaman="Paren Arithmetic Demo"',
    `actions+=/stormstrike,if=(${expression})`,
  ].join("\n"));

  const condition = getNode(graph.nodes, "condition__0__actions__0__if");
  expect(condition.type).toBe("condition");
  expect(condition.data).toMatchObject({
    label: expression,
    expressionKind: "comparison",
  });

  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(0);
});

test("explicit logical parentheses still create a grouped branch", () => {
  const graph = buildGraphFromText([
    'shaman="Logical Paren Demo"',
    "actions+=/stormstrike,if=(a|b)&c",
  ].join("\n"));

  const container = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(container.type).toBe("container");
  expect(container.data).toMatchObject({ operator: "group" });
  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(1);

  const innerA = getNode(graph.nodes, "condition__0__actions__0__if__0__inner__0");
  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__0__inner__1");
  const standaloneC = getNode(graph.nodes, "condition__0__actions__0__if__1");

  expect(innerA.data).toMatchObject({ label: "a" });
  expect(innerB.data).toMatchObject({ label: "b" });
  expect(standaloneC.data).toMatchObject({ label: "c" });
});

test("nested logical groups expand while arithmetic subexpressions stay atomic", () => {
  const expression =
    "(a|b)&cooldown.lava_lash.remains<gcd.max+(foo.bar*0.3)";
  const graph = buildGraphFromText([
    'shaman="Nested Logic Arithmetic Demo"',
    `actions+=/stormstrike,if=${expression}`,
  ].join("\n"));

  expect(graph.nodes.filter((node) => node.type === "container")).toHaveLength(1);

  const logicalContainer = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(logicalContainer.type).toBe("container");

  const comparison = getNode(graph.nodes, "condition__0__actions__0__if__1");
  expect(comparison.type).toBe("condition");
  expect(comparison.data).toMatchObject({
    label: "cooldown.lava_lash.remains<gcd.max+(foo.bar*0.3)",
    expressionKind: "comparison",
  });

  expect(
    graph.nodes.find((node) =>
      node.id.startsWith("condition__0__actions__0__if__1__"),
    ),
  ).toBeUndefined();
});

test("AND binds tighter than OR in the default condition graph", () => {
  const graph = buildGraphFromText([
    'shaman="Precedence Demo"',
    "actions+=/stormstrike,if=a&b|c",
  ].join("\n"));

  const andContainer = getNode(graph.nodes, "condition__0__actions__0__if__0");
  expect(andContainer.type).toBe("container");
  expect(andContainer.data).toMatchObject({ operator: "and" });

  const innerA = getNode(graph.nodes, "condition__0__actions__0__if__0__0");
  const innerB = getNode(graph.nodes, "condition__0__actions__0__if__0__1");
  const standaloneC = getNode(graph.nodes, "condition__0__actions__0__if__1");

  expect(innerA.data).toMatchObject({ label: "a" });
  expect(innerB.data).toMatchObject({ label: "b" });
  expect(standaloneC.data).toMatchObject({ label: "c" });

  const andEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__0__and__1");
  expect(andEdge).toMatchObject({ label: "AND" });

  const orEdge = getNode(graph.edges, "edge__condition__0__actions__0__if__or__1");
  expect(orEdge).toMatchObject({
    label: "OR",
    source: "condition__0__actions__0__if__0",
    target: "condition__0__actions__0__if__1",
  });
});

test("buildGraph is deterministic across repeated calls", () => {
  const snapshot = () => {
    const graph = buildGraphFromText(STRUCTURAL_APL);
    return graph.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }));
  };

  const first = snapshot();
  const second = snapshot();

  expect(first).toEqual(second);
});
