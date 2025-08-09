export const jsonParse = <T>(data: string) => {
	try {
		return JSON.parse(data) as T;
	} catch {
		return undefined;
	}
};
