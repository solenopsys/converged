import { describe, test, expect,jest ,beforeAll} from "bun:test";
import { UiButton } from "../src";
import {  fireEvent } from "@testing-library/dom";
import $ from "@solenopsys/converged-reactive";
import {render} from "@solenopsys/converged-renderer";
import { setTimeout as delay } from "node:timers/promises";
 


const tick = () => {
  return delay(1);
};

describe("Button", () => {
  test("dispatch click event", async () => {
    const handleClick = jest.fn();

    $.effect(() => {
      console.log("DOCUMENT", document.body.innerHTML);
    });

    console.log("ROOT");

    $.root(() => {
       render(
        UiButton( {title:"bla", onClick:{handleClick}} ),
        document.body
      );
      
    });

    const button = document.querySelector("button");
    expect(button?.title).toEqual("bla");
       fireEvent.click(button);
       await tick();
       console.log("DOCUMENT2", document.body.innerHTML);

    // console.log("STEP1");
    // await tick();
    // console.log("STEP2");
    // await tick();
    // console.log("STEP3");
    // await tick();

    // expect(handleClick).toHaveBeenCalledTimes(1);
  });
});