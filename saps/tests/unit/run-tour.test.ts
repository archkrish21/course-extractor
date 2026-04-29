import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachWaitForListener } from "@/lib/hooks/run-tour";

describe("attachWaitForListener — click", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fires the trigger when the targeted element is clicked", () => {
    const btn = document.createElement("button");
    btn.dataset.tour = "single";
    document.body.appendChild(btn);

    const onTrigger = vi.fn();
    attachWaitForListener({ event: "click", selector: "[data-tour='single']" }, onTrigger);
    btn.click();

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("fires once even when the selector matches multiple elements (any one wins)", () => {
    document.body.innerHTML = `
      <div data-tour="group">
        <button id="b1">A</button>
        <button id="b2">B</button>
        <button id="b3">C</button>
      </div>
    `;

    const onTrigger = vi.fn();
    attachWaitForListener({ event: "click", selector: "[data-tour='group'] button" }, onTrigger);

    document.getElementById("b2")!.click();
    document.getElementById("b3")!.click();

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("returns a cleanup function that removes the click listener", () => {
    const btn = document.createElement("button");
    btn.dataset.tour = "cleanup";
    document.body.appendChild(btn);

    const onTrigger = vi.fn();
    const cleanup = attachWaitForListener({ event: "click", selector: "[data-tour='cleanup']" }, onTrigger);
    cleanup();
    btn.click();

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("returns a no-op when the selector matches nothing", () => {
    const onTrigger = vi.fn();
    const cleanup = attachWaitForListener({ event: "click", selector: "[data-tour='missing']" }, onTrigger);
    expect(() => cleanup()).not.toThrow();
    expect(onTrigger).not.toHaveBeenCalled();
  });
});

describe("attachWaitForListener — input", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fires when the input value reaches minLength", () => {
    const input = document.createElement("input");
    input.dataset.tour = "search";
    document.body.appendChild(input);

    const onTrigger = vi.fn();
    attachWaitForListener({ event: "input", selector: "[data-tour='search']", minLength: 2 }, onTrigger);

    input.value = "a";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onTrigger).not.toHaveBeenCalled();

    input.value = "ap";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire after the threshold is exceeded", () => {
    const input = document.createElement("input");
    input.dataset.tour = "search";
    document.body.appendChild(input);

    const onTrigger = vi.fn();
    attachWaitForListener({ event: "input", selector: "[data-tour='search']", minLength: 1 }, onTrigger);

    input.value = "a";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "ab";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("defaults minLength to 1 when omitted", () => {
    const input = document.createElement("input");
    input.dataset.tour = "default-min";
    document.body.appendChild(input);

    const onTrigger = vi.fn();
    attachWaitForListener({ event: "input", selector: "[data-tour='default-min']" }, onTrigger);

    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
