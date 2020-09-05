/*
  Any Tag Attributes: {
    import-url: string,
    import-place: 'inside'|'replace'|'beforebegin'|'afterbegin'|'beforeend'|'afterend',
    onbeforeimport: function,
    onafterimport: function,
    onerror = function,
  }

  'import' Tag Attributes: {
    url: string,
    onbeforeimport: function,
    onafterimport: function,
    onerror = function,
  }
  place = 'replace' by default
*/

(function (global) {
  const importUrlAtt = "import-url";
  const importPlaceAtt = "import-place";
  const importSourceAtt = "import-source";
  const onBeforeImportAtt = "onbeforeimport";
  const onAfterImportAtt = "onafterimport";
  const onErrorImportAtt = "onerrorimport";

  const doNothing = () => {};

  function createElementsCollection(html) {
    let div = document.createElement("div");
    div.innerHTML = html;
    let children = [...div.children];
    div.innerHTML = "";
    return children;
  }

  function listImportTag(rootElement, elements = []) {
    for (let childElement of rootElement.children) {
      if (childElement.hasAttribute("import-url")) elements.push(childElement);
      listImportTag(childElement, elements);
    }
    return elements;
  }

  global.importAll = (rootElement = document.documentElement) => {
    if (rootElement == null) {
      return null;
    }
    return Promise.all(
      listImportTag(rootElement).map((element) => {
        const url = element.getAttribute(importUrlAtt);
        const place = element.getAttribute(importPlaceAtt) || "inside";
        const base = element.getAttribute(importSourceAtt) || window.location;
        const onBeforeImport =
          element.getAttribute(onBeforeImportAtt) || doNothing;
        const onAfterImport =
          element.getAttribute(onAfterImportAtt) || doNothing;
        const onErrorImportString = element.getAttribute(onErrorImportAtt);
        const onErrorImport = onErrorImportString
          ? new Function("event", onErrorImportString)
          : doNothing;
        const importSource = new URL(url, base);

        element.removeAttribute(importUrlAtt);
        element.removeAttribute(importPlaceAtt);
        element.removeAttribute(onBeforeImportAtt);
        element.removeAttribute(onAfterImportAtt);
        element.removeAttribute(onErrorImportAtt);

        return fetch(importSource)
          .then((response) => {
            if (response.ok) {
              return response.text();
            } else {
              throw response.statusText;
            }
          })
          .then((html) => {
            const newElements = createElementsCollection(html);
            newElements.forEach((element) =>
              element.setAttribute(importSourceAtt, importSource)
            );
            onBeforeImport(element, newElements);
            let newRootElement = element;
            switch (place) {
              case "inside":
                element.innerHTML = "";
                newElements.forEach((newElement) =>
                  element.insertAdjacentElement("beforeend", newElement)
                );
                break;
              case "replace":
                newElements.forEach((newElement) =>
                  element.insertAdjacentElement("beforebegin", newElement)
                );
                newRootElement = element.parentElement;
                newRootElement.removeChild(element);
                break;
              case "beforebegin":
              case "afterend":
                newRootElement = element.parentElement;
              case "afterbegin":
              case "beforeend":
                newElements.forEach((newElement) =>
                  element.insertAdjacentElement(place, newElement)
                );
                break;
              default:
                throw "unknown import-place attribute value";
            }
            onAfterImport(element, newElements);
            return importAll(newRootElement);
          })
          .catch((error) => {
            onErrorImport({ element, importSource, error });
            return Promise.resolve();
          });
      })
    );
  };
})(window);
