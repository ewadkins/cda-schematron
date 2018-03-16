<sch:pattern xmlns:sch="http://purl.oclc.org/dsdl/schematron" abstract="true" id="rootsect">
    <sch:rule context="$root" role="ERROR">
        <sch:assert test="true()">
            The element <name/> is root.
        </sch:assert>
    </sch:rule>
    <sch:rule context="$root" role="ERROR">
        <sch:assert test="$head">
            The element <name/> is a head.
        </sch:assert>
    </sch:rule>
    <sch:rule context="$root" role="ERROR">
        <sch:assert test="$body">
            The element <name/> is a body.
        </sch:assert>
    </sch:rule>
</sch:pattern>
