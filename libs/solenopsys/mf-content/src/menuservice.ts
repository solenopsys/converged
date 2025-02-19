import { MenuItemData } from "@solenopsys/ui-navigate";

type MenuIpfsItem = {
	key: string;
	name: string;
	path: string;
	articles: string[];
	children?: MenuIpfsItem[];
};

export class GroupService {
	public menuCache: { [key: string]: MenuIpfsItem } = {};
	public ancors : { [cid: string]: string } = {};
	idMap: { [key: string]: string } = {};

	constructor() {}

	itemTransform(item: MenuIpfsItem): MenuItemData {
		const items = item.children?.map((i) => this.itemTransform(i));
		return { link: item.path, name: item.name, items: items };
	}

	public async loadMenu(rootId: string): Promise<MenuItemData[]> {
		const items: MenuItemData[] = [];
		const menu = this.menuCache[rootId]
			? this.menuCache[rootId]
			: await this.loadPaths(rootId);
		menu.children?.forEach((i) => {
			items.push(this.itemTransform(i));
		});

		console.log("LOADED", items);
		return items;
	}

	public urlToId(url: string): string {
	
		let urlFixed = url === "/" ? "" : url;
		if (!urlFixed.endsWith(".")) {
			urlFixed = urlFixed + ".";
		}
		console.log("FIXED", urlFixed);
		console.log("URL TO ID",  this.idMap[urlFixed]);
		return this.idMap[urlFixed];
	}

	public async loadPaths(rootId: string): Promise<MenuIpfsItem> {
		if (this.menuCache[rootId]) {
			return this.menuCache[rootId];
		}

		const res = await fetch(`/dag?key=menu&cid=${rootId}`)
			.then((res) => res.json())
			.then((res) => this.transform(res, ""))
			.then((data) => {
				console.log("DATA", data);
				return data;
			});

		this.menuCache[rootId] = res;
		return res;
	}

	transform(tree: any, path: string): MenuIpfsItem {
		
		
		const pathFragment = tree["path"];
		if (pathFragment) path = path + "/" + pathFragment;
		
		this.idMap[path +   "/."] = tree.group;
		const children = tree["children"]?.map((child: any) =>
			this.transform(child, path),
		);
		return {
			key: pathFragment,
			articles: tree["articles"],
			name: tree["name"],
			children: children,
			path:path+"/",
		};
	}
}

export const GROUP_SERVICE = new GroupService();
