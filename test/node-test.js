const describes = [];
global.describe = function describe(msg, f) {
    describes.push([msg, f]);
}

function escseq(type, content) {
    return ["\x1b[", type, "m", content, "\x1b[0m"].join("");
}
function red(content) {
    return escseq(31, content);
}
function green(content) {
    return escseq(32, content);
}
function gray(content) {
    return escseq(90, content);
}

async function main() {
    let success = true;
    for (const [describeText, describeFunc] of describes) {
        const its = [];
        global.it = function it(desc, f) {
            its.push([desc, f]);
        }
        describeFunc();
        global.it = undefined;
        console.log("Running test (%s test cases): %s", its.length, describeText);
        const errors = [];
        let passing = 0;
        for (const [txt, fnc] of its) {
            await new Promise(function (done, errf) {
                try {
                    const r = fnc(function (err) { err ? errf(err) : done(); });
                    if (r && typeof r.then === "function") {
                        done(r);
                    }
                } catch (e) {
                    errf(e);
                }
            }).then(function () {
                console.log("  " + green("✓") + "  %s", txt);
                passing++;
            }, function (e) {
                errors.push([describeText + " " + txt, e]);
                console.error(red("  %s) %s"), errors.length, txt);
            });
        }

        console.log("\n" + (passing ? green : gray)("%s passing"), passing);
        console.error((errors.length ? red : gray)("%s failing"), errors.length);

        let i = 0;
        for (const [errorCase, e] of errors) {
            success = false;
            console.log("");
            console.warn(red("%s) %s"), ++i, errorCase);
            console.error(e);
        }
    }

    return success;
}

require("./tests");

main().then(function (s) {
    if (!s) {
        process.exitCode = 1;
    }
}, function (e) {
    process.exitCode = 2;
    console.error(e);
    if (e && e.stack) {
        console.warn(e.stack);
    }
    debugger;
})