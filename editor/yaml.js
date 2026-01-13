import yaml from "https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.mjs";

export function parseYaml(text) {
    try {
        return yaml.load(text);
    } catch (e) {
        console.error("YAML Parse Error", e);
        return {};
    }
}

export function dumpYaml(data) {
    return yaml.dump(data, {
        noRefs: true,
        sortKeys: false,
        lineWidth: 120,
        quotingType: '"'
    });
}