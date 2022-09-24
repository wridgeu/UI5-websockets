# UI5 with simple WebSocket Implementation

I recently worked a bit with WebSockets and had the fun to also use [APC/AMC](https://help.sap.com/docs/SAP_NETWEAVER_750/05d041d3df1a4595a3c45f57c15e2325/18ef61f6415743658407d4d17f06e950.html?version=7.5.9&locale=en-US) in addition to that.

In my specific use-case we have some sort of pseudo-login which is reponsible for establishing a WebSocket connection. As only after the user is "logged in" we retrieve the URL to which our WebSocket needs to connect to. We also close a connection whenever the user performs a "logout"/leaves a certain page. I know logouts are tricky and I don't want to go too deep into that. The "logout" I'm speaking of here is a simple backwards navigation. 
>**Note**
> In this scenario the application itself is embedded into the SAP Fiori Launchpad.

Of course one would need to also consider:

- ICF Path for logoff (Launchpad Logoff)
- F5/Tab Refresh
- Closing the Browser
- Closing the Tab
- etc.

Most of these scenarios, especially with Internet Explorer, are just a dead end. Nothing much you can do without doing it dirty/hacky. *If you have some Best Practices though, go ahead and shoot me a message, I'm happy & eager to learn*. If you're lucky enough to use the [Beacon API](https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API) go ahead!

So what did I do? I created a "WebSocketService" that does exactly what I need it to do. Not as flexible, resiliant and overall good designed as I'd like it to be but well, there are deadlines to be kept. The Service I'm using in this repository is a bit different as it uses some sort of "EventFacade", or "Registry" if you will(?), to hide some of the `attachEvent` logic behind an object and forward these EventRegistrations to the actual Service to not bloat up the WebSocketService object itself too much.

Overall It was my first time not directly going for the [EventBus](https://ui5.sap.com/sdk/#/api/sap.ui.core.EventBus) so I was excited to learn new things and tried out extending the [EventProvider](https://ui5.sap.com/sdk/#/api/sap.ui.base.EventProvider). This gives us the possibility to work on a less "global" level and have a better overview of whats happening, compared to using a general & generic global eventing tunnel (like the EventBus). So ... in theory better maintainability, right?

>**Note** 
>
> Quoting the UI5 Team [here](https://ui5.sap.com/sdk/#/api/sap.ui.core.EventBus): 
>"It is recommended to use the EventBus only when there is no other option to communicate between different instances, e.g. native UI5 events. Custom events can be fired by classes that extend sap.ui.base.EventProvider, such as sap.ui.core.Control, sap.ui.core.mvc.View or sap.ui.core.Component, and the events can be consumed by other classes to achieve communication between different instances.
>Heavily using the EventBus can easily result in code which is hard to read and maintain because it's difficult to keep an overview of all event publishers and subscribers."

The way I'm using it though, I'm not so sure if this "better maintainability" is still a factor or if what I did even makes sense. When I first came up with this I was quite happy though, I'll admit that much. I'm generally usually unhappy with what I do even if it does what it needs to. I just think I'm quite horrible in building/designing these things. Honestly speaking I'd probably rethink the entire thing about 300 more times, if I had the time. Then again, there is only so much "Web Developer" inside of me, and no one I can really ping-pong off for ideas so I'll leave it as is for now.

## Design/Idea Overview

I'm horrible with UML, so don't judge me. 😅 Some of the classes mentioned here aren't "real" compositions as they're not directly passed in through the constructor, but you get the gist.

![class_diagramm](./readme/class_uml.png)

The above Image describes a way of breaking up the dependencies between the WebSocketService and which Events other can listen to (attach/detach).

This is done by introducing a new Object, some sort of "registry" or "facade" where every possible event which could be fired according to an Actions-ENUM will be wrapped to expose a more "user-friendly"-API. Instead of retrieving the WebSocketService Instance and manually attaching events (+ using the ENUM) like so:

```js
const myWsService = this.getWebSocketService();
myWsService.attachEvent(ENUM.action, this.myHandlerFunction);
myWsService.detachEvent(ENUM.action, this.myHandlerFunction);
```

you could do it like this:

```js
const myFacade = this.getWebSocketService().getWebSocketEventFacade();
myFacade.attachMyActionEvent(this.myHandlerFunction)
myFacade.detachMyActionEvent(this.myHandlerFunction)
```

There are a few events which haven't had the honor to be taken into the ENUM. Namely all the events that do not map to a particular action that the frontend necessarily *wants* to listen to. The ENUM is just used as some sort of "contract", to get some sort of consistency with whatever comes from the backend. Therefore some of the rather technical/fallback events like `close`, `open` and the general `message` are not considered here. That is not a problem though, as these can just be taken into account within the "EventFacade".

## F.A.Q

> Why is the connection setup (WebSocket Instantiation) not happening in the constructor?

That indeed would make everything much easier. In my use-case I wanted to have the WebSocketService somewhat global but not as generic as the EventBus. That is why the Service Instance lives at component level and is implicitly handled as Singleton. Implicitly because the instance doesn't really prevent instantiation on a technical level (this could be changed though). It is instantiated and destroyed on component level (Component.js: `init` & `destroy`) and handed down into the rest of the application via the BaseController.

BaseController.js
```js 
getWebSocketService(){
  return this.getOwnerComponent().getWebSocketService()
}
``` 

In our case we didn't need multiple connections to different URLs however, the actual URL for the connection was only available at a certain point in time (after the pseudo-login). Which is why the Contstructor of the WebSocketService is not able to directly instantiate a WebSocket Instance. As the points in time for Service Instantiation and WebSocket instantiation differ.

An alternative way would be, to throw this "WebSocketService" away completely and directly use the UI5 standard WebSocket within one of the controllers but then again I think I would need to make use of the EventBus or similar to handle the reconnection and all that "properly". 

I've seen other applications not taking care of any of these things and simply creating a connection without ever closing them or caring if a reconnection is required. So you could definitely get away with simply opening up the connection, forwarding the events somehow (EventBus) or directly handling them in the current Controller and then never care about anything else that comes after.

> Is the "Facade" necessary?

Not at all. Any Controller/Object can just take the "WebSocketService"-Instance and call `attachEventXYZ` or `detachEventXYZ` on it.

> Are you using valid JSDoc

I'm really trying. Still not sure how to properly use it in custom projects (with custom namespaces etc.), other than basic JS types or defining custom Types ([@typedef](https://jsdoc.app/tags-typedef.html)) per file and including them everywhere (can't be the rigth/best approach, right?).

## NodeJS WebSocket Server for Testing

I'm using a simple NodeJS WebSocket Package calles "[ws](https://github.com/websockets/ws)" to spin up a samll `WebSocketServer` for some testing.

## Credits

This project has been generated with 💙 and [easy-ui5](https://github.com/SAP).

I'm standing on the shoulders of giants. Thanks.

- [Gregor Wolf](https://github.com/gregorwolf) PCP: https://blogs.sap.com/2015/09/07/abap-push-channel-messaging-channel-and-sapui5-demo-application/
- [Holger Schäfer](https://mobile.twitter.com/hschaefer123): https://btp.udina.de/development/websocket.html#sapui5
- PCP Protocol Spec: https://blogs.sap.com/2015/07/27/specification-of-the-push-channel-protocol-pcp/
- Cool WebSocket Extension (Chrome): https://chrome.google.com/webstore/detail/websocket-test-client/fgponpodhbmadfljofbimhhlengambbn?hl=en
