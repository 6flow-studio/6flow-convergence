import React, { useEffect, useMemo, useState } from "react";
import { Box, render, Text, useApp, useCursor, useInput, useStdout } from "ink";

type FocusPane = "projects" | "actions" | "console";

type Project = {
  id: string;
  name: string;
  updatedAt: string;
  status: "ready" | "draft";
};

type ActionItem = {
  id: "sync" | "simulate" | "deploy" | "secrets";
  label: string;
  description: string;
};

const INITIAL_PROJECTS: Project[] = [
  { id: "wf-001", name: "KYC Mint Flow", updatedAt: "2026-02-14 19:21", status: "ready" },
  { id: "wf-002", name: "Treasury Rebalance", updatedAt: "2026-02-14 11:02", status: "draft" },
  { id: "wf-003", name: "Settlement Trigger", updatedAt: "2026-02-13 23:41", status: "ready" },
];

const ACTIONS: ActionItem[] = [
  { id: "sync", label: "Sync projects", description: "Mock sync from frontend API" },
  { id: "simulate", label: "Simulate", description: "Mock run for selected project" },
  { id: "deploy", label: "Deploy", description: "Draft deploy flow (placeholder)" },
  { id: "secrets", label: "Manage secrets", description: "Draft secret manager flow" },
];

const STATUS_PANE_HEIGHT = 6;
const CONSOLE_PANE_HEIGHT = 12;
const CONSOLE_VIEWPORT_ROWS = 6;

function nowStamp() {
  return new Date().toLocaleTimeString();
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function Pane({
  title,
  focused,
  height,
  children,
}: {
  title: string;
  focused: boolean;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
      paddingX={1}
      height={height}
    >
      <Text color={focused ? "cyan" : "gray"}>{title}</Text>
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

function App() {
  const { stdout } = useStdout();
  const { exit } = useApp();
  useCursor(false);
  const getSafeRows = () => (stdout.rows && stdout.rows > 0 ? stdout.rows : 32);
  const getSafeColumns = () => (stdout.columns && stdout.columns > 0 ? stdout.columns : 120);

  const [focusPane, setFocusPane] = useState<FocusPane>("projects");
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>("never");
  const [terminalRows, setTerminalRows] = useState<number>(getSafeRows());
  const [terminalColumns, setTerminalColumns] = useState<number>(getSafeColumns());
  const [consoleOffset, setConsoleOffset] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    `[${nowStamp()}] Draft mode: no real API/Convex/CRE calls yet.`,
    `[${nowStamp()}] Use tab to switch pane, j/k to move, enter to run action.`,
  ]);

  const user = process.env.USER ?? "unknown";
  const selectedProject = projects[selectedProjectIndex];

  const statusLine = useMemo(() => {
    return `v0.0.1  | user: ${user}  | mode: draft/mock  | cre: not connected`;
  }, [user]);

  useEffect(() => {
    if (!stdout.isTTY || process.env.SIXFLOW_ALT_SCREEN !== "1") return;

    // Alternate screen buffer makes the UI behave like nano/full-screen apps.
    stdout.write("\u001b[?1049h\u001b[H");
    return () => {
      stdout.write("\u001b[?1049l");
    };
  }, [stdout]);

  useEffect(() => {
    if (!stdout.isTTY) return;

    const onResize = () => {
      setTerminalRows(getSafeRows());
      setTerminalColumns(getSafeColumns());
    };

    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const bodyHeight = Math.max(10, terminalRows - STATUS_PANE_HEIGHT);
  const actionsPaneHeight = Math.max(8, bodyHeight - CONSOLE_PANE_HEIGHT);

  const maxConsoleOffset = Math.max(0, logs.length - CONSOLE_VIEWPORT_ROWS);
  const safeConsoleOffset = Math.min(consoleOffset, maxConsoleOffset);
  const consoleStart = Math.max(0, logs.length - CONSOLE_VIEWPORT_ROWS - safeConsoleOffset);
  const visibleLogs = logs.slice(consoleStart, consoleStart + CONSOLE_VIEWPORT_ROWS);
  const consoleRange =
    logs.length === 0 ? "0/0" : `${consoleStart + 1}-${consoleStart + visibleLogs.length}/${logs.length}`;

  useEffect(() => {
    if (consoleOffset > maxConsoleOffset) {
      setConsoleOffset(maxConsoleOffset);
    }
  }, [consoleOffset, maxConsoleOffset]);

  const appendLog = (message: string) => {
    setLogs((current) => [...current, `[${nowStamp()}] ${message}`]);
    setConsoleOffset((current) => (current === 0 ? 0 : current + 1));
  };

  const runSelectedAction = async () => {
    if (isBusy) return;
    const action = ACTIONS[selectedActionIndex];
    if (!action || !selectedProject) return;

    setIsBusy(true);
    appendLog(`Action "${action.label}" started for ${selectedProject.name}.`);

    if (action.id === "sync") {
      await wait(350);
      appendLog("Mock: requesting /api/tui/workflows...");
      await wait(500);
      setLastSyncAt(new Date().toLocaleString());
      setProjects((current) =>
        current.map((item, index) =>
          index === selectedProjectIndex
            ? { ...item, updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }
            : item
        )
      );
      appendLog("Mock sync complete. Local project cache refreshed.");
    }

    if (action.id === "simulate") {
      await wait(300);
      appendLog(`Mock: building local run plan for "${selectedProject.id}"...`);
      await wait(450);
      appendLog("Mock: cre workflow simulate --config ./tmp/config.json");
      await wait(550);
      appendLog("Simulation finished (draft): no process was executed.");
    }

    if (action.id === "deploy") {
      await wait(300);
      appendLog("Deploy flow is draft-only in this iteration.");
      await wait(250);
      appendLog("Next phase: hook this action to CRE deploy proxy.");
    }

    if (action.id === "secrets") {
      await wait(300);
      appendLog("Secret manager flow is draft-only in this iteration.");
      await wait(250);
      appendLog("Next phase: attach to frontend API and local secure store.");
    }

    appendLog(`Action "${action.label}" completed.`);
    setIsBusy(false);
  };

  useInput((input, key) => {
    if ((key.ctrl && input === "c") || input === "q") {
      exit();
      return;
    }

    if (key.tab) {
      if (focusPane === "projects") setFocusPane("actions");
      else if (focusPane === "actions") setFocusPane("console");
      else setFocusPane("projects");
      return;
    }

    if (focusPane === "projects") {
      if (key.downArrow || input === "j") {
        setSelectedProjectIndex((value) => Math.min(value + 1, projects.length - 1));
      }
      if (key.upArrow || input === "k") {
        setSelectedProjectIndex((value) => Math.max(value - 1, 0));
      }
    }

    if (focusPane === "actions") {
      if (key.downArrow || input === "j") {
        setSelectedActionIndex((value) => Math.min(value + 1, ACTIONS.length - 1));
      }
      if (key.upArrow || input === "k") {
        setSelectedActionIndex((value) => Math.max(value - 1, 0));
      }
      if (key.return) {
        void runSelectedAction();
      }
    }

    if (focusPane === "console" && input === "c") {
      setLogs([`[${nowStamp()}] Console cleared.`]);
      setConsoleOffset(0);
      return;
    }

    if (focusPane === "console") {
      if (key.upArrow || input === "k") {
        setConsoleOffset((value) => Math.min(value + 1, maxConsoleOffset));
      }
      if (key.downArrow || input === "j") {
        setConsoleOffset((value) => Math.max(value - 1, 0));
      }
      if (input === "g") {
        setConsoleOffset(maxConsoleOffset);
      }
      if (input === "G") {
        setConsoleOffset(0);
      }
    }
  });

  return (
    <Box flexDirection="column" width={terminalColumns} height={terminalRows}>
      <Pane title="Status / Info" focused={false} height={STATUS_PANE_HEIGHT}>
        <Text color="cyan">六</Text>
        <Text>{statusLine}</Text>
        <Text>
          projects: {projects.length} | selected: {selectedProject?.name ?? "-"} | last sync: {lastSyncAt}
        </Text>
        <Text color="gray">
          keys: tab switch pane, j/k move, enter run, c clear console, g top logs, G bottom logs, q quit
        </Text>
      </Pane>

      <Box flexGrow={1}>
        <Box flexGrow={3}>
          <Pane title={`Projects [${projects.length}]`} focused={focusPane === "projects"} height={bodyHeight}>
            {projects.map((project, index) => (
              <Text key={project.id} color={index === selectedProjectIndex ? "cyan" : undefined}>
                {index === selectedProjectIndex ? "> " : "  "}
                {project.name} ({project.status}) - {project.updatedAt}
              </Text>
            ))}
          </Pane>
        </Box>

        <Box flexGrow={2} flexDirection="column">
          <Pane title={`Actions [${ACTIONS.length}]`} focused={focusPane === "actions"} height={actionsPaneHeight}>
            {ACTIONS.map((action, index) => (
              <Text key={action.id} color={index === selectedActionIndex ? "cyan" : undefined}>
                {index === selectedActionIndex ? "> " : "  "}
                {action.label}
              </Text>
            ))}
            <Box marginTop={1}>
              <Text color="gray">{ACTIONS[selectedActionIndex]?.description}</Text>
            </Box>
            <Box>
              <Text color={isBusy ? "yellow" : "gray"}>{isBusy ? "running..." : "idle"}</Text>
            </Box>
          </Pane>

          <Pane
            title={`Console [${logs.length}] (${consoleRange})`}
            focused={focusPane === "console"}
            height={CONSOLE_PANE_HEIGHT}
          >
            {visibleLogs.map((line, index) => (
              <Text key={`${line}-${index}`}>{line}</Text>
            ))}
          </Pane>
        </Box>
      </Box>
    </Box>
  );
}

render(<App />);
