<sch:pattern xmlns:sch="http://purl.oclc.org/dsdl/schematron" abstract="true" id="table">
    <sch:rule context="$table">
        <sch:assert test="$row">
            The element <name/> is a table. Tables contain rows.
        </sch:assert>
    </sch:rule>
    <sch:rule context="$row">
        <sch:assert test="$entry">
            The element <name/> is a table row. Rows contain entries.
        </sch:assert>
    </sch:rule>
</sch:pattern>
