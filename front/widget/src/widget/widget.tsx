import { useEffect, useCallback } from 'preact/hooks';
import { FloatingInputPanel } from '../components/input/FloatingInputPanel';
import { FloatingMessageStack } from '../components/chat/FloatingMessageStack';
import {
  $chatUi,
  $chatState,
  $userText,
  openChat,
  closeChat,
  userTextChanged,
  sendMessageRequested,
  setInputPanelExpanded,
  setMessageStackWidth,
  attachmentsSelected
} from './chatUi';
import { useStore } from '../shared/effector/useStore';
import { $fileTransferItems, enqueueFiles } from '../features/file-transfer/model';

// @ts-ignore
import styles from './widget.module.css';

const ChatWidget = () => {
  const {
    isOpen,
    isExpanded,
    messageStackWidth
  } = useStore($chatUi);
  const chatState = useStore($chatState);
  const userText = useStore($userText);
  const fileTransfers = useStore($fileTransferItems);

  useEffect(() => {
    const width = !isOpen ? 280 : isExpanded ? 420 : 340;
    setMessageStackWidth(width);
  }, [isOpen, isExpanded]);

  const handleAttachFiles = useCallback((files: File[]) => {
    if (!files.length) {
      return;
    }
    attachmentsSelected(files);
    enqueueFiles(files);
  }, []);

  return (
    <div className={styles.widgetContainer}>
      <FloatingMessageStack
        messages={chatState.messages}
        currentResponse={chatState.currentResponse}
        isLoading={chatState.isLoading}
        width={messageStackWidth}
      />
      <FloatingInputPanel
        isOpen={isOpen}
        isExpanded={isExpanded}
        userText={userText}
        canSend={!chatState.isLoading}
        width={messageStackWidth}
        onOpen={openChat}
        onClose={closeChat}
        onSend={sendMessageRequested}
        onTextChange={userTextChanged}
        onExpandedChange={setInputPanelExpanded}
        onAttachFiles={handleAttachFiles}
        files={fileTransfers}
      />
    </div>
  );
};

export default ChatWidget;
