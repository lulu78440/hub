"""Services extérieurs simulés (aucune requête ne sort de la machine de test)."""
import json, re, itertools

_ids = itertools.count(1)


class FakeGitHub:
    """Imite l'API Gists de GitHub (lister, créer, lire, modifier) pour un jeton factice."""

    def __init__(self, token):
        self.token = token
        self.gists = {}
        self.calls = []
        self.offline = False

    def __call__(self, route):
        req = route.request
        if not req.url.startswith("https://api.github.com/"):
            return False
        self.calls.append((req.method, req.url, req.headers.get("authorization", "")))
        if self.offline:
            route.abort(); return True
        if req.headers.get("authorization") != "Bearer " + self.token:
            route.fulfill(status=401, body="{}"); return True
        path = req.url.split("https://api.github.com", 1)[1]
        if req.method == "GET" and path.startswith("/gists?"):
            body = [{"id": k, "description": g["description"], "files": {n: {} for n in g["files"]}} for k, g in self.gists.items()]
        elif req.method == "POST" and path == "/gists":
            d = json.loads(req.post_data); k = "g%d" % next(_ids)
            self.gists[k] = {"description": d["description"], "public": d["public"], "files": {n: f["content"] for n, f in d["files"].items()}}
            body = {"id": k}
        elif re.match(r"^/gists/[\w]+$", path):
            k = path.split("/")[2]
            if k not in self.gists:
                route.fulfill(status=404, body="{}"); return True
            if req.method == "PATCH":
                d = json.loads(req.post_data)
                for n, f in d["files"].items():
                    self.gists[k]["files"][n] = f["content"]
            g = self.gists[k]
            body = {"id": k, "files": {n: {"content": c, "truncated": False} for n, c in g["files"].items()}}
        else:
            route.fulfill(status=404, body="{}"); return True
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        return True
