function domReplaceNode(newNode, oldNode) {
  oldNode.parentNode.replaceChild(newNode, oldNode);
}

const getProp = (prop) => "const " + prop + " = _." + prop + ";";
const getProps = (props) => props.map(getProp).reduce((a, b) => a + b, "");

const getFunc = (func) => {
  const name = func[0];
  const n = func[1];
  let f = "const " + name + " = ";
  let params = "(";
  for (let i = 0; i < n; i++) {
    params += String.fromCharCode(97 + i);
    if (i < n - 1) {
      params += ", ";
    }
  }
  params += ")";
  f += params + " => _." + name + params + ";";
  return f;
};
const getFuncs = (funcs) => funcs.map(getFunc).reduce((a, b) => a + b, "");

const pre = getFuncs([
  ["createCanvas", 2], ["noLoop", 0], ["background", 4], ["color", 4],
  ["red", 1], ["green", 1], ["blue", 1], ["alpha", 1],
]) +
getProps([
  "pixels", "width", "height",
]);

const putFunc = (func) => "if (typeof " + func + " !== 'undefined') _." + func + " = " + func + ";";
const putFuncs = (funcs) => funcs.map(putFunc).reduce((a, b) => a + b, "");
const post = putFuncs([
  "setup", "draw",
]);

let sketches = [];
function loadSketches() {
  console.log("loadSketches");
  let elements = document.getElementsByTagName("sketch");
  while (elements.length != 0) {
    let element = elements[0];
    let name = element.getAttribute("name");
    let id = element.getAttribute("id");
    let div = document.createElement("div");
    if (name) {
      if (!sketches[name]) {
        sketches[name] = [];
        sketches[name]["id"] = 0;
        sketches[name]["constructor"] = (s) => {
        };
      }
      if (!id) {
        id = "sketch." + name + "." + (sketches[name]["id"]++);
      }
      div.setAttribute("id", id);
      domReplaceNode(div, element);
      if (sketches[name]["script"]) {
        let script = sketches[name]["script"];
        if (script.executed) {
          new p5(sketches[name]["constructor"], id);
        } else {
          script.addEventListener("execution", function() {
            new p5(sketches[name]["constructor"], id);
          });
        }
      } else {
        let script = document.createElement("script");
        script.executed = false;
        script.addEventListener("execution", function() {
          script.executed = true;
          new p5(sketches[name]["constructor"], id);
        });
        document.body.appendChild(script);
        sketches[name]["script"] = script;

        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          if (this.readyState == 4 && this.status == 200) {
            let scriptContent = this.responseText;
            script.innerHTML = "sketches['" + name + "']['constructor'] =" +
              "function (_) {\n" + pre + scriptContent + post + "\n}\n" +
              "sketches['" + name + "']['script'].dispatchEvent(new Event('execution'));";
          }
        };
        xhr.open("GET", "sketches/" + name + ".js", true);
        xhr.send();
      }
    }
  }
};
window.addEventListener("load", loadSketches);

const epsilon = 0.001;
// point1 == point2 if euclid_dist(point1, point2)² < eps
function equals(point1, point2) {
  if (point1.length != point2.length) throw new Error();
  let length = point1.length;
  let dist = 0;
  for (let i = 0; i < length; i++) {
    let d = point2[i] - point1[i];
    dist += d * d;
    if (dist > eps) {
      return false;
    }
  }
  return true;
}

// @TODO: put all the following in OO form.

/*
* viewport is initialized with (mid, length) or (min, max).

min    = mid - length / 2;
max    = mid + length / 2;

mid    = (max + min) / 2;
length = (max - min);

* coordinate transformation:
view <-> world = [[0, size]] <-> [min, max];

[[a, b]] means an integer interval with length = b - a + 1.
[a, b] means a real interval with length = b - a.

* to map a a value from an interval to another :
[a, b] -f-> [0, 1] -g-> [0, 1] -h-> [c, d]
[c, d] -f-> [0, 1] -g_inv-> [0, 1] -h-> [a, b]

f(x) = (x - a) / (b - a); (from any interval to [0, 1])
g(x) = ...; (to apply effects. preferably g(0) = 0 and g(1) = 1)
(ex: x, x², sin(x * 2 / pi))
h(x) = x * (d - c) + c; (from [0, 1] to any interval)

if g = id then h(g(f(x))) = (x - a) * (d - c) / (b - a) + c

* A view is always a discret region and it contains colors.
A world can be a discret or a continuous region and it can contain anything.

* To show a 2D world in a 2D view :
for vx = 0 to vw - 1
  for vy = 0 to vh - 1
    [wx, wy] = viewToWorld([vx, vy]);
    something = world([wx, wy]);
    color = somethingToColor(something);
    view[vx, vy] = color;
  end
end

*/

class IntToRealInterval {
  constructor(minInt, maxInt, minReal = 0, maxReal = 1, reverse = false) {
    this.minInt = minInt;
    this.maxInt = maxInt;
    this.minReal = minReal;
    this.maxReal = maxReal;
    this.reverse = reverse;
  }

  midInt() {
    return Math.floor((this.minInt + this.maxInt) / 2);
  }

  midReal() {
    return (this.minReal + this.maxReal) / 2;
  }

  lengthInt() {
    return this.maxInt - this.minInt;
  }

  lengthReal() {
    return this.maxReal - this.minReal;
  }

  intToRealFactor() {
    return this.lengthReal() / this.lengthInt();
  }

  realToIntFactor() {
    return this.lengthInt() / this.lengthReal();
  }

  intToReal(i) {
    return (this.reverse ? this.maxInt - i : i - this.minInt) *
      this.intToRealFactor() + this.minReal;
  }

  realToInt(r) {
    return Math.floor((this.reverse ? this.maxReal - r : r - this.minReal) *
      this.realToIntFactor() + this.minInt);
  }

  moveByReal(dr) {
    this.minReal += dr;
    this.maxReal += dr;
  }

  moveToReal(r) {
    this.moveByReal(x - this.midReal())
  }

  changeLengthByReal(dl) {
    let dl_ = dl / 2;
    this.minReal -= dl_;
    this.maxReal += dl_;
  }

  changeLengthToReal(l) {
    this.changeLengthByReal(l - this.lengthReal());
  }

}

class Viewport {
  constructor(viewWidth, viewHeight, xMin = -1, xMax = 1, yMin = -1, yMax = 1) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.x = new IntToRealInterval(0, viewWidth - 1, xMin, xMax);
    this.y = new IntToRealInterval(0, viewHeight - 1, yMin, yMax, true);
  }

  coordsToIndex(xv, yv) {
    return yv * this.viewWidth + xv;
  }

  // map world to view.
  worldToViewXFactor() {
    return this.x.realToIntFactor();
  }
  worldToViewX(x) {
    return this.x.realToInt(x);
  }
  viewToWorldXFactor() {
    return this.x.intToRealFactor();
  }
  viewToWorldX(x) {
    return this.x.intToReal(x);
  }

  worldToViewYFactor() {
    return this.y.realToIntFactor();
  }
  worldToViewY(y) {
    return this.y.realToInt(y);
  }
  viewToWorldYFactor() {
    return this.y.intToRealFactor();
  }
  viewToWorldY(y) {
    return this.y.intToReal(y);
  }

  midWorldX() {
    return this.x.midReal();
  }
  midWorldY() {
    return this.y.midReal();
  }

  // mid += d
  moveByX(dx) {
    this.x.moveByReal(dx);
  }
  // mid = x
  moveToX(x) {
    this.x.moveToReal(x);
  }

  moveByY(dy) {
    this.y.moveByReal(dy);
  }
  moveToY(y) {
    this.y.moveToReal(y);
  }

  // length -= d
  zoomByX(dz) {
    this.x.changeLengthByReal(dz);
  }
  // length = d
  zoomToX(z) {
    this.x.changeLengthToReal(z);
  }

  zoomByY(dz) {
    this.y.changeLengthByReal(dz);
  }
  zoomToY(z) {
    this.y.changeLengthToReal(z);
  }

}
