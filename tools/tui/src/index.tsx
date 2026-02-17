import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, render, Text, useApp, useCursor, useInput, useStdout } from "ink";
import {
  clearAuthSession,
  isSessionValid,
  loadAuthSession,
  saveAuthSession,
} from "./lib/auth-session";
import { runBrowserLoginFlow } from "./lib/device-link";
import {
  fetchFrontendWorkflows,
  FrontendUnauthorizedError,
} from "./lib/frontend-api";

type AppPhase = "checkingAuth" | "authGate" | "linking" | "ready";
type FocusPane = "status" | "projects" | "actions" | "console";

type Project = {
  id: string;
  name: string;
  updatedAt: string;
  status: "ready" | "draft";
  nodeCount: number;
};

type ActionItem = {
  id: "refresh" | "simulate" | "deploy" | "secrets";
  label: string;
  description: string;
};

const ACTIONS: ActionItem[] = [
  {
    id: "refresh",
    label: "Sync",
    description: "Fetch real workflow list from frontend API",
  },
  { id: "simulate", label: "Simulate", description: "Mock run for selected project" },
  { id: "deploy", label: "Deploy", description: "Draft deploy flow (placeholder)" },
  { id: "secrets", label: "Manage secrets", description: "Draft secret manager flow" },
];

const STATUS_PANE_HEIGHT = 6;
const MIN_WORKFLOWS_PANE_HEIGHT = 4;
const MIN_ACTIONS_PANE_HEIGHT = 6;
const WEB_BASE_URL = process.env.SIXFLOW_WEB_URL ?? "http://localhost:3000";

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
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}

function App() {
  const { stdout } = useStdout();
  const { exit } = useApp();
  useCursor(false);

  const getSafeRows = () => (stdout.rows && stdout.rows > 0 ? stdout.rows : 32);
  const getSafeColumns = () =>
    stdout.columns && stdout.columns > 0 ? stdout.columns : 120;

  const [phase, setPhase] = useState<AppPhase>("checkingAuth");
  const [authState, setAuthState] = useState<"connected" | "disconnected">(
    "disconnected"
  );
  const [token, setToken] = useState<string | null>(null);

  const [focusPane, setFocusPane] = useState<FocusPane>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>("never");

  const [terminalRows, setTerminalRows] = useState<number>(getSafeRows());
  const [terminalColumns, setTerminalColumns] = useState<number>(getSafeColumns());
  const [consoleOffset, setConsoleOffset] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    `[${nowStamp()}] Frontend API mode enabled (${WEB_BASE_URL}).`,
    `[${nowStamp()}] Checking local authentication session...`,
  ]);

  const user = process.env.USER ?? "unknown";
  const selectedProject = projects[selectedProjectIndex] ?? null;

  const statusLine = useMemo(() => {
    return `v0.0.1 | user: ${user} | mode: frontend-api | auth: ${authState}`;
  }, [authState, user]);

  const appendLog = useCallback((message: string) => {
    setLogs((current) => [...current, `[${nowStamp()}] ${message}`]);
    setConsoleOffset((current) => (current === 0 ? 0 : current + 1));
  }, []);

  const refreshWorkflows = useCallback(
    async (authToken: string, source: "startup" | "action" | "login") => {
      setIsBusy(true);
      if (source === "action") {
        appendLog("Refreshing workflows from frontend API...");
      } else {
        appendLog("Loading workflows from frontend API...");
      }

      try {
        const workflows = await fetchFrontendWorkflows({
          baseUrl: WEB_BASE_URL,
          token: authToken,
        });

        const mapped: Project[] = workflows.map((workflow) => ({
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          nodeCount: workflow.nodeCount,
          updatedAt: new Date(workflow.updatedAt).toLocaleString(),
        }));

        setProjects(mapped);
        setSelectedProjectIndex((value) => {
          if (mapped.length === 0) return 0;
          return Math.min(value, mapped.length - 1);
        });
        setLastSyncAt(new Date().toLocaleString());
        appendLog(
          `Fetched ${mapped.length} workflow${mapped.length === 1 ? "" : "s"} from frontend API.`
        );
      } catch (error) {
        if (error instanceof FrontendUnauthorizedError) {
          appendLog("Session rejected by frontend API. Login required.");
          await clearAuthSession();
          setToken(null);
          setAuthState("disconnected");
          setPhase("authGate");
          return;
        }

        appendLog(
          `Workflow fetch failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      } finally {
        setIsBusy(false);
      }
    },
    [appendLog]
  );

  const startLoginFlow = useCallback(async () => {
    if (isBusy) return;

    setIsBusy(true);
    setPhase("linking");
    appendLog("Starting browser login flow...");

    try {
      const result = await runBrowserLoginFlow({
        webBaseUrl: WEB_BASE_URL,
        onLog: appendLog,
      });

      const saved = await saveAuthSession(result.token);
      if (!isSessionValid(saved)) {
        throw new Error("Received an invalid or expired token.");
      }

      setToken(result.token);
      setAuthState("connected");
      setPhase("ready");
      appendLog("Authentication completed. Loading workflows...");
      setIsBusy(false);
      await refreshWorkflows(result.token, "login");
      return;
    } catch (error) {
      appendLog(
        `Login flow failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setAuthState("disconnected");
      setPhase("authGate");
    } finally {
      setIsBusy(false);
    }
  }, [appendLog, isBusy, refreshWorkflows]);

  useEffect(() => {
    if (!stdout.isTTY || process.env.SIXFLOW_ALT_SCREEN !== "1") return;

    // Alternate screen buffer makes the UI behave like full-screen terminal apps.
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

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const session = await loadAuthSession();
      if (cancelled) return;

      if (isSessionValid(session)) {
        setToken(session.token);
        setAuthState("connected");
        setPhase("ready");
        appendLog("Found valid local session.");
        await refreshWorkflows(session.token, "startup");
        return;
      }

      if (session) {
        await clearAuthSession();
        appendLog("Saved session is expired. Login required.");
      } else {
        appendLog("No saved session found.");
      }

      if (!cancelled) {
        setAuthState("disconnected");
        setPhase("authGate");
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [appendLog, refreshWorkflows]);

  const runSelectedAction = async () => {
    if (isBusy) return;

    const action = ACTIONS[selectedActionIndex];
    if (!action) return;

    if (action.id === "refresh") {
      if (!token) {
        appendLog("No active session. Please log in first.");
        setPhase("authGate");
        return;
      }
      await refreshWorkflows(token, "action");
      return;
    }

    if (!selectedProject) {
      appendLog("Select a workflow first.");
      return;
    }

    setIsBusy(true);
    appendLog(`Action "${action.label}" started for ${selectedProject.name}.`);

    if (action.id === "simulate") {
      await wait(300);
      appendLog(`Mock: building run plan for "${selectedProject.id}"...`);
      await wait(450);
      appendLog("Mock: cre workflow simulate --config ./tmp/config.json");
      await wait(550);
      appendLog("Simulation finished (placeholder): no process was executed.");
    }

    if (action.id === "deploy") {
      await wait(300);
      appendLog("Deploy flow is placeholder-only in this iteration.");
      await wait(250);
      appendLog("Next phase: hook this action to CRE deploy API.");
    }

    if (action.id === "secrets") {
      await wait(300);
      appendLog("Secret manager flow is placeholder-only in this iteration.");
      await wait(250);
      appendLog("Next phase: attach to frontend secret APIs.");
    }

    appendLog(`Action "${action.label}" completed.`);
    setIsBusy(false);
  };

  const bodyHeight = Math.max(10, terminalRows - STATUS_PANE_HEIGHT);
  const desiredActionsPaneHeight = Math.floor(bodyHeight * 0.35);
  const actionsPaneHeight = Math.min(
    Math.max(MIN_ACTIONS_PANE_HEIGHT, desiredActionsPaneHeight),
    bodyHeight - MIN_WORKFLOWS_PANE_HEIGHT
  );
  const workflowsPaneHeight = bodyHeight - actionsPaneHeight;
  const consoleViewportRows = Math.max(3, bodyHeight - 2);

  const maxConsoleOffset = Math.max(0, logs.length - consoleViewportRows);
  const safeConsoleOffset = Math.min(consoleOffset, maxConsoleOffset);
  const consoleStart = Math.max(
    0,
    logs.length - consoleViewportRows - safeConsoleOffset
  );
  const visibleLogs = logs.slice(consoleStart, consoleStart + consoleViewportRows);
  const consoleRange =
    logs.length === 0
      ? "0/0"
      : `${consoleStart + 1}-${consoleStart + visibleLogs.length}/${logs.length}`;

  useInput((input, key) => {
    if ((key.ctrl && input === "c") || input === "q") {
      exit();
      return;
    }

    if (phase === "authGate") {
      const normalized = input.toLowerCase();
      if (normalized === "y") {
        void startLoginFlow();
        return;
      }
      if (normalized === "n") {
        exit();
      }
      return;
    }

    if (phase !== "ready") {
      return;
    }

    if (input === "1") {
      setFocusPane("status");
      return;
    }
    if (input === "2") {
      setFocusPane("projects");
      return;
    }
    if (input === "3") {
      setFocusPane("actions");
      return;
    }
    if (input === "4") {
      setFocusPane("console");
      return;
    }

    if (key.tab) {
      if (focusPane === "status") setFocusPane("projects");
      else if (focusPane === "projects") setFocusPane("actions");
      else if (focusPane === "actions") setFocusPane("console");
      else setFocusPane("status");
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
      if (key.return || key.space || input === " ") {
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

  useEffect(() => {
    if (consoleOffset > maxConsoleOffset) {
      setConsoleOffset(maxConsoleOffset);
    }
  }, [consoleOffset, maxConsoleOffset]);

  if (phase !== "ready") {
    return (
      <Box flexDirection="column" width={terminalColumns} height={terminalRows}>
        <Pane
          title="Authentication"
          focused
          height={Math.max(12, terminalRows - 1)}
        >
          <Text color="cyan">六</Text>
          {phase === "checkingAuth" && <Text>Checking saved session...</Text>}
          {phase === "authGate" && (
            <>
              <Text>Log in now?</Text>
              <Text color="gray">Press Y to start login flow, or N to quit.</Text>
            </>
          )}
          {phase === "linking" && (
            <Text>Login in progress. Complete authentication in your browser.</Text>
          )}
          <Box marginTop={1} flexDirection="column">
            {logs.slice(-8).map((line, index) => (
              <Text key={`${line}-${index}`} color="gray">
                {line}
              </Text>
            ))}
          </Box>
        </Pane>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={terminalColumns} height={terminalRows}>
      <Pane title="六 6FLOW TUI: Status / Info [1]" focused={focusPane === "status"} height={STATUS_PANE_HEIGHT}>
        <Text color="cyan">六</Text>
        <Text>{statusLine}</Text>
        <Text>
          workflows: {projects.length} | selected: {selectedProject?.name ?? "-"} | last sync: {lastSyncAt}
        </Text>
        <Text color="gray">
          keys: 1-4 pane, tab next pane, j/k move, enter/space run, c clear console, g top logs, G bottom logs, q quit
        </Text>
      </Pane>

      <Box flexGrow={1} flexDirection="row">
                <Box flexGrow={3} flexDirection="column">
          <Pane title="Workflows [2]" focused={focusPane === "projects"} height={workflowsPaneHeight}>
            {projects.length === 0 ? (
              <Text color="gray">No workflows found.</Text>
            ) : (
              projects.map((project, index) => (
                <Text key={project.id} color={index === selectedProjectIndex ? "cyan" : undefined}>
                  {index === selectedProjectIndex ? "> " : "  "}
                  {project.name} ({project.status}) - {project.nodeCount} nodes - {project.updatedAt}
                </Text>
              ))
            )}
          </Pane>

          <Pane title="Actions [3]" focused={focusPane === "actions"} height={actionsPaneHeight}>
            {ACTIONS.map((action, index) => (
              <Text key={action.id} color={index === selectedActionIndex ? "cyan" : undefined}>
                {index === selectedActionIndex ? "> " : "  "}
                {action.label}
              </Text>
            ))}
            {/* <Box marginTop={1}>
              <Text color="gray">{ACTIONS[selectedActionIndex]?.description}</Text>
            </Box> */}
            <Box>
              <Text color={isBusy ? "yellow" : "gray"}>{isBusy ? "running..." : "idle"}</Text>
            </Box>
          </Pane>
        </Box>
        <Box flexGrow={2}>
          <Pane
            title={`Console [4] (${consoleRange})`}
            focused={focusPane === "console"}
            height={bodyHeight}
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
