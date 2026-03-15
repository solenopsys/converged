/** A node in the classifier tree */
export interface ClassifierNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
}

export interface ClassifierService {
  addNode(node: Omit<ClassifierNode, "id"> & { id?: string }): Promise<string>;
  getNode(id: string): Promise<ClassifierNode | null>;
  getChildren(parentId: string): Promise<ClassifierNode[]>;
  listRoots(): Promise<ClassifierNode[]>;
}
