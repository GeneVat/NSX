# NDX
***
NDX is a HTML syntax.
#### Tags
$ are open tags and % are optional closing tags.
@script is used for js
#### Format

Content is put after the tag with no closing:
`$h1 Hi` becomes ` <h1> Hi </h1> `

Nesting is done by add a second tag:
`$div $h1 Hi` becomes 
` <div> <h1> Hi </h1> </div>`

To Nest a 2nd coponent is by adding a closing tag after the first child to start another child:
`$div $h1 1st child %h1 $h1 2nd child %h1`
becomes 
` <div> <h1> 1st child </h1> <h1> 2nd child </h1> </div>`

All lines compile as one line,
` $div $h1 Hi `
` $h2 Hi `
Will compile the same as: ` $div $h1 Hi $h2 Hi ` 
Which will output:  ` <div> <h1> Hi <h2> Hi </h2> </h1> </div> `
With the <h2> inside the <h1>
To output:  ` <div> <h1> Hi </h1> <h2> Hi </h2> </div> `
Write,
` $div $h1 Hi %div`
` $h2 Hi `
or 
` $div $h1 Hi`
` & $h2 Hi `
Using the second will end all tags so a <html> around the whole file would end.

#### Inline Styling and classes
To add a style  `$h1=style="color:red;"` or `$h1+style="color:red;"`
The 1st one doesnt work on %img that only have ending tags.

Use ! to create pre classed or styled
`!bluetext $p=style="color: blue;"`
now `$bluetext` will be $p=style="color: blue;"
`+` is a space
#### TLDR

$ - Open Tag
% - Closing tag
& - 'Starts' new code disconected from the rest 
add +class/href/style="text" to a open tag to add content
@, same as $, but for JS
