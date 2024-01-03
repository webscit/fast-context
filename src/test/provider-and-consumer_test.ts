/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  attr,
  customElement,
  DOM,
  FASTElement,
  html,
  nullableNumberConverter,
} from '@microsoft/fast-element';

import {Context, defineConsumer, defineProvider} from 'fast-element-context';
import {assert} from '@esm-bundle/chai';

const simpleContext = 'simple-context' as Context<'simple-context', number>;

@customElement({
  name: 'context-consumer-and-provider',
  template: html`Value <span id="value">${(x) => x.value}</span
    ><span id="fromAbove">${(x) => x.provided}</span><slot></slot>`,
})
class ContextConsumerAndProviderElement extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public provided = 0;

  @attr({converter: nullableNumberConverter})
  public value = 0;

  constructor() {
    super();
    defineConsumer(this, 'provided', {context: simpleContext, subscribe: true});
    defineProvider(this, 'value', {context: simpleContext});
  }
}

suite('@providerAndConsumer', () => {
  let root: ContextConsumerAndProviderElement;
  let parent: ContextConsumerAndProviderElement;
  let child: ContextConsumerAndProviderElement;
  let container: HTMLElement;
  setup(async () => {
    container = document.createElement('div');
    container.innerHTML = `
      <context-consumer-and-provider id="root" value="10" provided="20">
        <context-consumer-and-provider id="parent" value="100" provided="200">
          <context-consumer-and-provider id="child"></context-consumer-and-provider>
        </context-consumer-and-provider>
      </context-consumer-and-provider>
    `;
    document.body.appendChild(container);

    root = container.querySelector(
      '#root'
    ) as ContextConsumerAndProviderElement;

    parent = container.querySelector(
      '#parent'
    ) as ContextConsumerAndProviderElement;

    child = container.querySelector(
      '#child'
    ) as ContextConsumerAndProviderElement;

    DOM.processUpdates();

    assert.isDefined(child);
  });

  teardown(() => {
    document.body.removeChild(container);
  });

  test(`parent receives a context from root`, async () => {
    assert.strictEqual(parent.provided, 10);
  });
  test(`child receives a context from parent`, async () => {
    assert.strictEqual(child.provided, 100);
  });

  test(`parent receives updated context on root change`, async () => {
    assert.strictEqual(parent.provided, 10);
    root.value = 50;
    DOM.processUpdates();
    assert.strictEqual(parent.provided, 50);
  });

  test(`child does not receives updated context on root change`, async () => {
    assert.strictEqual(child.provided, 100);
    root.value = 51;
    DOM.processUpdates();
    assert.strictEqual(child.provided, 100);
  });

  test(`child receives updated context on parent change`, async () => {
    assert.strictEqual(child.provided, 100);
    parent.value = 500;
    DOM.processUpdates();
    assert.strictEqual(child.provided, 500);
  });
});
