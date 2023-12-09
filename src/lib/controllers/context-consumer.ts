/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {Behavior, FASTElement} from '@microsoft/fast-element'
import {observable} from '@microsoft/fast-element'
import {
  ContextCallback,
  ContextRequestEvent,
} from '../context-request-event.js';
import type {Context, ContextType} from '../create-context.js';


export interface Options<C extends Context<unknown, unknown>> {
  context: C;
  callback?: (value: ContextType<C>, dispose?: () => void) => void;
  subscribe?: boolean;
}

/**
 * A Behavior which adds context consuming behavior to a custom
 * element by dispatching `context-request` events.
 *
 * When the host element is connected to the document it will emit a
 * `context-request` event with its context key. When the context request
 * is satisfied the controller will invoke the callback, if present, and
 * trigger a host update so it can respond to the new value.
 *
 * It will also call the dispose method given by the provider when the
 * host element is disconnected.
 */
export class ContextConsumer<
  C extends Context<unknown, unknown>,
  HostElement extends FASTElement = FASTElement
> implements Behavior
{
  protected host: HostElement | null = null;
  private context: C;
  private callback?: (value: ContextType<C>, dispose?: () => void) => void;
  private subscribe = false;

  private provided = false;

  @observable value?: ContextType<C> = undefined;

  constructor(options: Options<C>) {
    // This is a potentially fragile duck-type. It means a context object can't
    // have a property name context and be used in positional argument form.
    this.context = options.context;
    this.callback = options.callback;
    this.subscribe = options.subscribe ?? false;
  }

  bind(source: HostElement): void {
    this.host = source;
    this.hostConnected();
  }

  unbind(): void {
    this.hostDisconnected()
  }

  hostConnected(): void {
    this.dispatchRequest();
  }

  hostDisconnected(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private dispatchRequest() {
    this.host?.$fastController.element.dispatchEvent(
      new ContextRequestEvent(this.context, this._callback, this.subscribe)
    );
  }

  private unsubscribe?: () => void;

  // This function must have stable identity to properly dedupe in ContextRoot
  // if this element connects multiple times.
  private _callback: ContextCallback<ContextType<C>> = (value, unsubscribe) => {
    // some providers will pass an unsubscribe function indicating they may provide future values
    if (this.unsubscribe) {
      // if the unsubscribe function changes this implies we have changed provider
      if (this.unsubscribe !== unsubscribe) {
        // cleanup the old provider
        this.provided = false;
        this.unsubscribe();
      }
      // if we don't support subscription, immediately unsubscribe
      if (!this.subscribe) {
        this.unsubscribe();
      }
    }

    // store the value so that it can be retrieved from the controller
    // as it is an observable it will trigger an template update if needed.
    this.value = value;

    // only invoke callback if we are either expecting updates or have not yet
    // been provided a value
    if (!this.provided || this.subscribe) {
      this.provided = true;
      if (this.callback) {
        this.callback(value, unsubscribe);
      }
    }

    this.unsubscribe = unsubscribe;
  };
}
