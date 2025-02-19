 
async function fetchArticle(id:string) {
	return (await fetch(`/dag?key=md&cid=${id}`)).json();
}

export async function cascadeFetch(groupId: string) {
	console.log("GROUPID MD FETH", groupId);

	

	return await (await fetch(`/dag?key=group&cid=${groupId}`)).json();;
}