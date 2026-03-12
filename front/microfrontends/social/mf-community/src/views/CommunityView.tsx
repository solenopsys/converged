import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderPanel, ThreadedChat, cn } from "front-core";
import type { CommunitySection, CommunityTopic, SectionTreeNode } from "g-community";
import type { Message as ThreadMessage } from "g-threads";
import { MessageType } from "integration/types/threads";
import { communityClient, threadsClient } from "../services";
import styles from "./CommunityView.module.css";

type CommunityEnv = {
  userId?: string;
  title?: string;
  rootId?: string;
};

type ThreadMessageView = {
  id: string;
  beforeId?: string;
  user: string;
  content: string;
  timestamp: number;
};

type TopicRow = CommunityTopic & {
  sectionTitle?: string;
};

function readCommunityEnv(): Required<CommunityEnv> {
  const globalEnv = (globalThis as any).__MF_ENV__ as Record<string, unknown> | undefined;
  const raw = (globalEnv?.["mf-community"] ?? {}) as CommunityEnv;

  return {
    userId: raw.userId ?? "guest",
    title: raw.title ?? "Community",
    rootId: raw.rootId ?? "",
  };
}

function flattenSections(nodes: SectionTreeNode[]): CommunitySection[] {
  const out: CommunitySection[] = [];
  const visit = (items: SectionTreeNode[]) => {
    for (const node of items) {
      out.push(node);
      if (Array.isArray(node.children) && node.children.length > 0) {
        visit(node.children);
      }
    }
  };
  visit(nodes);
  return out;
}

function mapThreadMessages(input: ThreadMessage[]): ThreadMessageView[] {
  return input
    .map((message, index) => ({
      id: message.id ?? `msg-${index}-${message.timestamp ?? Date.now()}`,
      beforeId: message.beforeId,
      user: message.user ?? "unknown",
      content: message.data ?? "",
      timestamp: message.timestamp ?? 0,
    }))
    .filter((message) => message.content.length > 0);
}

function findFirstSectionId(nodes: SectionTreeNode[]): string {
  const flat = flattenSections(nodes);
  return flat[0]?.id ?? "";
}

function buildInitialExpanded(nodes: SectionTreeNode[]): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  for (const node of nodes) {
    expanded[node.id] = true;
  }
  return expanded;
}

export const CommunityView = () => {
  const env = useMemo(() => readCommunityEnv(), []);

  const [sections, setSections] = useState<SectionTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [messages, setMessages] = useState<ThreadMessageView[]>([]);
  const [replyToId, setReplyToId] = useState<string>("");
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  const replyTarget = useMemo(
    () => messages.find((message) => message.id === replyToId) ?? null,
    [messages, replyToId],
  );

  const loadSections = useCallback(async () => {
    setIsLoadingSections(true);
    setError(null);
    try {
      const tree = await communityClient.readSectionsTree(env.rootId || undefined, false);
      const nodes = Array.isArray(tree) ? (tree as SectionTreeNode[]) : [];
      setSections(nodes);
      setExpanded((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return buildInitialExpanded(nodes);
      });

      setSelectedSectionId((current) => {
        if (current && flattenSections(nodes).some((node) => node.id === current)) {
          return current;
        }
        return findFirstSectionId(nodes);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sections");
      setSections([]);
      setSelectedSectionId("");
    } finally {
      setIsLoadingSections(false);
    }
  }, [env.rootId]);

  const loadTopics = useCallback(
    async (sectionId: string, options?: { silent?: boolean }) => {
      if (!sectionId) {
        setTopics([]);
        setSelectedTopicId("");
        return;
      }

      if (!options?.silent) {
        setIsLoadingTopics(true);
        setError(null);
      }

      try {
        const response = await communityClient.listTopics({
          offset: 0,
          limit: 500,
          sectionId,
          includeArchived: false,
        });
        const items = Array.isArray(response?.items) ? (response.items as TopicRow[]) : [];
        setTopics(items);

        setSelectedTopicId((current) => {
          if (!current) return "";
          return items.some((topic) => topic.id === current) ? current : "";
        });
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Failed to load topics");
        }
      } finally {
        if (!options?.silent) {
          setIsLoadingTopics(false);
        }
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async (topic: CommunityTopic | null, options?: { silent?: boolean }) => {
      if (!topic) {
        setMessages([]);
        setReplyToId("");
        return;
      }

      if (!options?.silent) {
        setIsLoadingMessages(true);
        setError(null);
      }

      try {
        const rows = await threadsClient.readThreadAllVersions(topic.threadId);
        const messagesRows = Array.isArray(rows) ? (rows as ThreadMessage[]) : [];
        setMessages(mapThreadMessages(messagesRows));
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Failed to load topic messages");
        }
      } finally {
        if (!options?.silent) {
          setIsLoadingMessages(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  useEffect(() => {
    void loadTopics(selectedSectionId);
    const timer = setInterval(() => {
      if (!selectedSectionId) return;
      void loadTopics(selectedSectionId, { silent: true });
    }, 7000);

    return () => clearInterval(timer);
  }, [loadTopics, selectedSectionId]);

  useEffect(() => {
    void loadMessages(selectedTopic);
    const timer = setInterval(() => {
      if (!selectedTopic) return;
      void loadMessages(selectedTopic, { silent: true });
    }, 5000);

    return () => clearInterval(timer);
  }, [loadMessages, selectedTopic]);

  const onSendMessage = useCallback(
    async (content: string) => {
      if (!selectedTopic) return;
      const text = content.trim();
      if (!text || isSending) return;

      setIsSending(true);
      setError(null);
      try {
        await threadsClient.saveMessage({
          threadId: selectedTopic.threadId,
          beforeId: replyToId || undefined,
          user: env.userId,
          type: MessageType.message,
          data: text,
        });
        setReplyToId("");
        await loadMessages(selectedTopic, { silent: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsSending(false);
      }
    },
    [env.userId, isSending, loadMessages, replyToId, selectedTopic],
  );

  const headerConfig = useMemo(
    () => ({
      title: selectedTopic ? `${env.title} / ${selectedTopic.title}` : env.title,
      actions: [],
    }),
    [env.title, selectedTopic],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const renderTreeNode = useCallback(
    (node: SectionTreeNode) => {
      const children = Array.isArray(node.children) ? node.children : [];
      const hasChildren = children.length > 0;
      const isExpanded = expanded[node.id] ?? false;
      const isSelected = selectedSectionId === node.id;

      return (
        <div key={node.id} className={styles.treeNode}>
          <div className={styles.treeLine}>
            {hasChildren ? (
              <button
                type="button"
                className={styles.treeToggle}
                onClick={() => toggleExpanded(node.id)}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? "▾" : "▸"}
              </button>
            ) : (
              <span className={styles.treeSpacer} />
            )}
            <button
              type="button"
              className={cn(styles.treeButton, isSelected ? styles.treeButtonActive : undefined)}
              onClick={() => {
                setSelectedSectionId(node.id);
                setSelectedTopicId("");
              }}
            >
              {node.title}
            </button>
          </div>

          {hasChildren && isExpanded ? (
            <div className={styles.treeChildren}>{children.map((child) => renderTreeNode(child))}</div>
          ) : null}
        </div>
      );
    },
    [expanded, selectedSectionId, toggleExpanded],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBody}>
            {isLoadingSections ? <div className={styles.placeholder}>Loading sections...</div> : null}
            {!isLoadingSections && sections.length === 0 ? (
              <div className={styles.placeholder}>No sections</div>
            ) : null}
            <div className={styles.treeRoot}>{sections.map((node) => renderTreeNode(node))}</div>
          </div>
        </aside>

        <section className={styles.content}>
          {!selectedTopic ? (
            <div className={styles.contentPad}>
              {!selectedSectionId ? (
                <div className={styles.placeholder}>Select a section</div>
              ) : null}

              {selectedSectionId ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Author</th>
                        <th>Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingTopics ? (
                        <tr>
                          <td colSpan={3} className={styles.placeholder}>Loading topics...</td>
                        </tr>
                      ) : null}

                      {!isLoadingTopics && topics.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={styles.placeholder}>No topics in this section</td>
                        </tr>
                      ) : null}

                      {!isLoadingTopics
                        ? topics.map((topic) => (
                            <tr key={topic.id}>
                              <td>
                                <button
                                  type="button"
                                  className={styles.tableRowButton}
                                  onClick={() => {
                                    setSelectedTopicId(topic.id);
                                    setReplyToId("");
                                  }}
                                >
                                  {topic.title}
                                </button>
                              </td>
                              <td>{topic.createdBy}</td>
                              <td>{new Date(topic.lastActivityAt).toLocaleString()}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.topicToolbar}>
                <button
                  type="button"
                  className={styles.topicBack}
                  onClick={() => {
                    setSelectedTopicId("");
                    setReplyToId("");
                  }}
                >
                  Back to topics
                </button>
                <div className={styles.topicTitle}>{selectedTopic.title}</div>

                {replyTarget ? (
                  <div className={styles.replyHint}>
                    Reply to: {replyTarget.user}
                    <button
                      type="button"
                      className={styles.replyCancel}
                      onClick={() => setReplyToId("")}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 min-h-0">
                <ThreadedChat
                  messages={messages}
                  isLoading={isLoadingMessages || isSending}
                  currentResponse=""
                  send={onSendMessage}
                  placeholder={replyTarget ? "Write a reply..." : "Write a comment..."}
                  renderMessage={(message) => {
                    const own = message.user === env.userId;
                    return (
                      <div className={cn(styles.messageRow, own ? styles.messageRowUser : styles.messageRowPeer)}>
                        <div className={own ? styles.userBubble : styles.peerBubble}>
                          {!own ? <div className={styles.peerUser}>{message.user}</div> : null}
                          <div className={styles.messageText}>{message.content}</div>
                          <div className={styles.messageActions}>
                            <button
                              type="button"
                              className={styles.messageReply}
                              onClick={() => setReplyToId(message.id)}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  renderLoading={() => <div className={styles.loading}>Loading messages...</div>}
                  intro={<div className={styles.emptyState}>No posts yet. Be first to comment.</div>}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
