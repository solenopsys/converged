import $ from "@solenopsys/converged-reactive";

export async function jsonFeth(url:string,dataBody:any) {
    const data = $(undefined);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataBody)
      });

      const json = await response.json();
      data(json);
    } catch (error) {
      console.error(error);
    }

    return data;
  }