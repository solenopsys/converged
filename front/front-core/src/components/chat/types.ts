export type ThreadMessageBase = {
  id: string;
  beforeId?: string;
  timestamp?: number;
};

export type ThreadFlatNode<TMessage extends ThreadMessageBase> = {
  message: TMessage;
  depth: number;
  index: number;
};
