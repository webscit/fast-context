/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {Behavior} from '@microsoft/fast-element';
import {ContextRequestEvent} from '../context-request-event.js';
import {ValueNotifier} from '../value-notifier.js';
import type {Context, ContextType} from '../create-context.js';

declare global {
  interface HTMLElementEventMap {
    /**
     * A 'context-provider' event can be emitted by any element which hosts
     * a context provider to indicate it is available for use.
     */
    'context-provider': ContextProviderEvent<Context<unknown, unknown>>;
  }
}

export class ContextProviderEvent<
  C extends Context<unknown, unknown>
> extends Event {
  readonly context: C;

  /**
   *
   * @param context the context which this provider can provide
   */
  constructor(context: C) {
    super('context-provider', {bubbles: true, composed: true});
    this.context = context;
  }
}

export interface Options<C extends Context<unknown, unknown>> {
  context: C;
  initialValue?: ContextType<C>;
}

/**
 * A Behavior which adds context provider behavior to a
 * custom element.
 *
 * This controller simply listens to the `context-request` event when
 * the host is connected to the DOM and registers the received callbacks
 * against its observable Context implementation.
 *
 * The controller may also be attached to any HTML element in which case it's
 * up to the user to call hostConnected() when attached to the DOM. This is
 * done automatically for any custom elements implementing
 * ReactiveControllerHost.
 *
 * ### Note
 * If the element is a standard HTMLElement, we use a ResizeObserver to
 * be notified of the element connection to the DOM. However that notification
 * arrives after the children elements handle their behavior (including the
 * context consumer behavior). Therefore their registration will be missed
 * except if a {@link ContextRoot} is set up.
 */
export class ContextProvider<
    T extends Context<unknown, unknown>,
    HostElement extends HTMLElement = HTMLElement
  >
  extends ValueNotifier<ContextType<T>>
  implements Behavior
{
  protected readonly host: HostElement;
  private readonly context: T;
  private isReady = false;

  constructor(el: HostElement, options: Options<T>) {
    super(options.initialValue);
    this.host = el;
    this.context = options.context;

    // @ts-expect-error in case of a FASTElement
    if (this.host.$fastController) {
      // @ts-expect-error in case of a FASTElement
      this.host.$fastController.addBehaviors([this]);
    } else {
      const connectionCallback = () => {
        if (this.host.isConnected) {
          if (!this.isReady) {
            this.isReady = true;
            this.hostConnected();
          }
        } else {
          if (this.isReady) {
            this.isReady = false;
            this.hostDisconnected();
          }
        }
      };

      const attachObserver = new ResizeObserver(connectionCallback);
      connectionCallback();
      attachObserver.observe(this.host);
    }
  }

  bind(): void {
    this.hostConnected();
  }

  unbind(): void {
    this.hostDisconnected();
  }

  onContextRequest = (
    ev: ContextRequestEvent<Context<unknown, unknown>>
  ): void => {
    // Only call the callback if the context matches.
    // Also, in case an element is a consumer AND a provider
    // of the same context, we want to avoid the element to self-register.
    // The check on composedPath (as opposed to ev.target) is to cover cases
    // where the consumer is in the shadowDom of the provider (in which case,
    // event.target === this.host because of event retargeting).
    const consumerHost = ev.composedPath()[0] as Element;
    if (ev.context !== this.context || consumerHost === this.host) {
      return;
    }
    ev.stopPropagation();
    this.addCallback(ev.callback, consumerHost, ev.subscribe);
  };

  /**
   * When we get a provider request event, that means a child of this element
   * has just woken up. If it's a provider of our context, then we may need to
   * re-parent our subscriptions, because is a more specific provider than us
   * for its subtree.
   */
  onProviderRequest = (
    ev: ContextProviderEvent<Context<unknown, unknown>>
  ): void => {
    // Ignore events when the context doesn't match.
    // Also, in case an element is a consumer AND a provider
    // of the same context it shouldn't provide to itself.
    // We use composedPath (as opposed to ev.target) to cover cases
    // where the consumer is in the shadowDom of the provider (in which case,
    // event.target === this.host because of event retargeting).
    const childProviderHost = ev.composedPath()[0] as Element;
    if (ev.context !== this.context || childProviderHost === this.host) {
      return;
    }
    // Re-parent all of our subscriptions in case this new child provider
    // should take them over.
    const seen = new Set<unknown>();
    for (const [callback, {consumerHost}] of this.subscriptions) {
      // Prevent infinite loops in the case where a one host element
      // is providing the same context multiple times.
      //
      // While normally it's a no-op to attempt to re-parent a subscription
      // that already has its proper parent, in the case where there's more
      // than one ValueProvider for the same context on the same hostElement,
      // they will each call the consumer, and since they will each have their
      // own dispose function, a well behaved consumer will notice the change
      // in dispose function and call their old one.
      //
      // This will cause the subscriptions to thrash, but worse, without this
      // set check here, we can end up in an infinite loop, as we add and remove
      // the same subscriptions onto the end of the map over and over.
      if (seen.has(callback)) {
        continue;
      }
      seen.add(callback);
      consumerHost.dispatchEvent(
        new ContextRequestEvent(this.context, callback, true)
      );
    }
    ev.stopPropagation();
  };

  hostConnected(): void {
    this.host.addEventListener('context-request', this.onContextRequest);
    this.host.addEventListener('context-provider', this.onProviderRequest);

    // emit an event to signal a provider is available for this context
    this.host.dispatchEvent(new ContextProviderEvent(this.context));
  }

  hostDisconnected(): void {
    this.host.removeEventListener('context-request', this.onContextRequest);
    this.host.removeEventListener('context-provider', this.onProviderRequest);
  }
}
