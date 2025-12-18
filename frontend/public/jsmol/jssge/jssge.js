/*

  site/jssge 
  Jmol Spin Space Group Explorer
  Bob Hanson, 2025.11.24


*/


startModel = "2.116.Na3Co2SbO6.scif";
defaultScript = "set defaultLattice {555 555 -1};"
structureLoadedScript = "vector max 3.0;"

showFrames = true;
showFrames = false; // no operator frame business

isSpinSpaceGroup = false;
isSpinOp = false;
sgOp = "";
spinOp = ""; 
spinSpaceToggle = "spin"; // or "space" or "both"

 Jmol.Info.j2sPath = "../j2s"
 Jmol.Info.serverURL = "https://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php"

datadir = "."
jmolSetMenuCssClass('" style="font-style:italic"')

var Models = "-01=" + startModel + ",\
";
Models = Models.split(",")

var modelSelectHtml


selectedModel = ""

function getModelSelectHtml() {
	Models = Models.sort()
	var xxxx = document.location.search
	var isDefault = true
	if (xxxx.indexOf("?load") == 0) {
		defaultScript = unescape(xxxx.substring(1))
		isDefault = false
  } else if (xxxx.indexOf("?cod=") == 0) {
		defaultScript = "load =cod/"+xxxx.substring(5).split(".")[0]
		isDefault = false
	} else if (xxxx.length > 1) {
		selectedModel = xxxx
		isDefault = false
		defaultScript = 'set echo top left;echo loading ' + selectedModel + '...;refresh;load ' + xxxx + ';echo "";'
	} else {
		selectedModel = datadir + "/" + startModel
		isDefault = false
  }
	var s = "<select id='modelselect' onchange=getModel() onkeypress=\"setTimeout('getModel()',50)\"><option value=''>select a model</option>"
	if (!isDefault) {
		var S = selectedModel.split("/")
		s += "<option selected value='"+selectedModel+"'>" + S[S.length - 1] + "</option>"
	}
	for (var i = 0; i < Models.length; i++) {
		var S = Models[i];
		if (S.indexOf("-") == 0)
		S = S.split("=")[1]
		S = S.split("|")
		var m = S[0];
		var sg = S[1];
		if (sg)sg =  " (" + sg + ")"
		var isSelected = (m.indexOf("*")>=0 && isDefault)
		m = m.replace(/\*/,"")
		if (isSelected)selectedModel = m
		var fname = m.split(".")[0].split(" ")
		var n = fname[0]
		if (fname[1]) {
			m = m.substring(n.length + 1);
		}
		var f = (n.indexOf("=") == 0 ? "\"" + m.replace(/ /,'" '): datadir + "/" + m)
		if (m.indexOf("----") >= 0)
		     f = "zap";
		s += "<option value='" + f + "' " + (isSelected ? " selected": "") + ">" + n.replace(/\=/,"") + "</option>"
	}
	s += "</select>"
	modelSelectHtml = s
	if (selectedModel && selectedModel.indexOf("/") < 0) selectedModel = datadir + "/" + selectedModel
	if (selectedModel && !defaultScript)defaultScript = "load " + selectedModel

}getModelSelectHtml()

//// user actions from selections

function getModel(justCheck) {
	var d = document.getElementById("modelselect")
	if (d.selectedIndex == 0)return
	var model = d[d.selectedIndex].value
	if (!model || justCheck && model == selectedModel)return
	selectedModel = model
	var cmd = (model == "zap" ? model : "load " + model);
	document.getElementById("jmolCmd0").value=cmd
	jmolScript(cmd)
}

function getTxtOp() {
	getSelect(document.getElementById("txtop").value)
}

function getSelect(symop) {
	var d = document.getElementById("atomselect")
	var atomi = d.selectedIndex
	var pt00 = d[d.selectedIndex].value
	var showatoms = (document.getElementById("chkatoms").checked || atomi == 0)
	jmolScript("display " + (showatoms ? "all" : "none"))
	var d = document.getElementById("symselect")
	var iop = parseInt(d[d.selectedIndex].value)
	if (!iop && !symop) symop = document.getElementById("txtop").value
	if (!symop) {
		if (!iop) {
			jmolScript("select *;color opaque;draw sym_* delete")
			return
		}
		symop = d[d.selectedIndex].text;
		symop = symop.substring(symop.indexOf("(") + 1, symop.length - 1);
	}
	symop = symop.split("(");
	spaceOp = symop[0].trim();
	spinOp = (symop[1] ? symop[1].split(')')[0] : "");
	switch(spinSpaceToggle) {
	case "space":
		symop = spaceOp;
		break;
	case "spin":
	case "both":
		symop = spaceOp + "(" + spinOp + ")";
		break;
	}
	document.getElementById("txtop").value = symop
	if (pt00.indexOf("{") < 0)pt00 = "{atomindex=" + pt00 + "}" 
	var d = document.getElementById("selopacity")
	var opacity = parseFloat(d[d.selectedIndex].value)
	if (opacity < 0) opacity = 1
	var script = "select *;color atoms translucent " + (1-opacity)
	script += ";draw symop \"" + symop + "\" " + pt00 + ";"
	if (atomi == 0) {
		script += ";select symop=1555 or symop=" + iop + "555;color opaque;"
	} else if (atomi >= 3) {
		script += ";pt1 = " + pt00 + ";pt2 = all.symop(\"" + symop + "\",pt1).uxyz.xyz;select within(0.2,pt1) or within(0.2, pt2);color opaque;" 
	}
	secho = SymInfo[symop]
	if (!secho){
		secho = jmolEvaluate("all.symop('" + symop + "',{0 0 0},'draw')").split("\n")[0]
		if (secho.indexOf("//") == 0) {
			secho = secho.substring(2)	
		} else {
			secho = symop
		}
	}
	script = "set echo top right;echo " + secho + ";" + script
	jmolScript(script)
}

function doarrow(x) {
	var d = document.getElementById("symselect")
	x += d.selectedIndex
	if (x < 0 || x >= d.length) return
	d.selectedIndex = x
	getSelect()
}

/// Jmol callbacks

function errorCallback(a, b, msg) {
 alert(msg)
}

function loadstructCallback() {
	Jmol.script(jmolApplet0,structureLoadedScript);
	document.getElementById("note").style.display = "block"
	document.getElementById("loading").style.display = "block"
  Jmol.script(jmolApplet0,"set echo bottom left;echo @_modelName") 
	setTimeout('getSymInfo()',100) // need the timeout to get another thread or this will lock
}

function pickCallback(a,b,i) {
	var d = document.getElementById("atomselect")
	d.selectedIndex = i + 3
	document.getElementById("chkatoms").checked = true
	getSelect()
}

function do_rad_display(btn) {
	spinSpaceToggle = btn.id.substring(btn.id.lastIndexOf("_") + 1);
	getSelect();
}

function getRadio(name, label, isSelected) {
	var s = "<input type=radio name=" + name 
			+ " id=" + name + "_" + label 
			+ " onclick=do_" + name + "(this) " 
			+ (isSelected ? " checked" : "") 
			+ "/>"+ label
	return s;
}

SymInfo = {}

function getSymInfo() {

	// update all of the model-specific page items

	SymInfo = {}
	var s = ""
	var info = jmolEvaluate('script("show spacegroup")')
	if (info.indexOf("x,") < 0) {
		s = "no space group"
	} else {
		isSpinSpaceGroup = (info.indexOf("u") >= 0 && info.indexOf("v") >= 0 && info.indexOf("w") >= 0);
		var S = info.split("\n");
		var hm = "?"
		var itcnumber = "?"
		var hallsym = "?"
		var latticetype = "?"
		var nop = 0 
		var slist = ""
		for (var i = 0; i < S.length; i++) {
			var line = S[i].split(":")
			if (line[0].indexOf("Hermann-Mauguin symbol") == 0)
				s += "<br>" + S[i].replace(/Hermann\-Mauguin/,"<a href=http://en.wikipedia.org/wiki/Hermann%E2%80%93Mauguin_notation target=_blank>Hermann-Mauguin</a>")
			else if (line[0].indexOf("international table number") == 0)
				s += "<br>" + S[i].replace(/international table number/,"<a href=http://it.iucr.org/ target=_blank>international table</a> number")
			else if (line[0].indexOf("Hall symbol") == 0)
				s += "<br>" + S[i].replace(/Hall symbol/,"<a href=http://cci.lbl.gov/sginfo/hall_symbols.html target=_blank>Hall</a> symbol")
			else if (line[0].indexOf("lattice type") == 0)
				s += "<br>" + S[i].replace(/lattice type/,"<a href=http://cst-www.nrl.navy.mil/bind/static/lattypes.html target=_blank>lattice type</a>")
			else if (line[0].indexOf(" symmetry operations") >= 0) 
				nop = parseInt(line[0])
			else if (nop > 0 && line[0].indexOf(",") >= 0)
				slist += "\n" + S[i]		
			else if (nop == 0 && line[0].indexOf("1\t") >= 0
				 || nop < 0 && line[0].indexOf(",") >= 0) {
				nop = (nop ? --nop : -1);
				slist += "\n" + S[i];
			}
		}
		if (nop < 0) 
			nop = -nop;
		s += "<br>";
		if (isSpinSpaceGroup)
			s += getRadio("rad_display", "space", true) + getRadio("rad_display", "spin") + getRadio("rad_display", "both");
		s += "<br><a href=javascript:doarrow(-1)><img align=bottom src=arrowleft.png border=0 /></a> "
		s += nop + " operators"
		s += " <a href=javascript:doarrow(1)><img align=bottom src=arrowright.png border=0 /></a>"

		var S = slist.split("\n")
		var n = 0;
		var i = -1;while (S[++i].indexOf(",") < 0){}
		s += "<br><select id='symselect' onchange=getSelect() onkeypress=\"setTimeout('getSelect()',50)\"><option value=0>select a symmetry operation</option>"
		for (;i < S.length;i++)
			if (S[i].indexOf("x") >= 0) {
				var sopt = S[i].split("|")[0].split("\t")
				SymInfo[sopt[1]] = S[i].replace(/\t/,": ").replace(/\t/,"|")
				sopt = sopt[0] + ": " + sopt[2] + " (" + sopt[1] + ")"
				s += "<option value='" + parseInt(sopt) + "'>" + sopt + "</option>" 
			}
		s += "</select>"

		s += "</br><input type=text id=txtop width=30 value='1-x,1-y,1-z' />&nbsp;&nbsp;<a href=javascript:getTxtOp()>show</a>"

		var info = jmolEvaluate('{*}.label("#%i %a {%[fxyz]/1}")').split("\n")
		var nPoints = info.length
		var nBase = jmolEvaluate('{symop=1555}.length')
		s += "<br><select id='atomselect' onchange=getSelect() onkeypress=\"setTimeout('getSelect()',50)\"><option value=0>base atoms</option>"
		s += "<option value='{0 0 0}'>{0 0 0}</option>"
		s += "<option value='{1/2 1/2 1/2}'>{1/2 1/2 1/2}</option>"
		for (var i = 0; i < nPoints; i++)
			s+= "<option value=" + i + (i == 0 ? " selected" : "") + ">" + info[i] + "</option>" 
		s += "</select>"

		s += "</br><input type=checkbox id=chkatoms onchange=getSelect() />show atoms"
		s += " opacity:<select id=selopacity onchange=getSelect() onkeypress=\"setTimeout('getSelect()',50)\">"
		  + "<option value=0.0>0%</option>"
		  + "<option value=0.2 selected>20%</option>"
		  + "<option value=0.4>40%</option>"
		  + "<option value=0.6>60%</option>"
		  + "<option value=1.0>100%</option>"
		  + "</select>"
		
	}
	document.getElementById("syminfo").innerHTML = s
}

